import {
  BadRequestException,
  ConflictException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { toCamelCase, toPascalCase } from '@guanghechen/helper-string';
import { HttpService } from '@nestjs/axios';
import { catchError, lastValueFrom, map, of } from 'rxjs';
import mustache from 'mustache';
import mergeWith from 'lodash/mergeWith';
import { ApiFunction, CustomFunction, Environment, Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import {
  ApiFunctionResponseDto,
  ArgumentsMetadata,
  ArgumentType,
  Auth,
  Body,
  CustomFunctionSpecification,
  FunctionArgument,
  FunctionBasicDto,
  FunctionDetailsDto,
  Visibility,
  Header,
  Method,
  PostmanVariableEntry,
  PropertySpecification,
  PropertyType,
  ServerFunctionSpecification,
  Specification,
  TeachResponseDto,
  Variables,
} from '@poly/common';
import { EventService } from 'event/event.service';
import { AxiosError } from 'axios';
import { CommonService } from 'common/common.service';
import { PathError } from 'common/path-error';
import { ConfigService } from 'config/config.service';
import { AiService } from 'ai/ai.service';
import { compareArgumentsByRequired } from 'function/comparators';
import { FaasService } from 'function/faas/faas.service';
import { KNativeFaasService } from 'function/faas/knative/knative-faas.service';
import { transpileCode } from 'function/custom/transpiler';
import { SpecsService } from 'specs/specs.service';
import { ApiFunctionArguments } from './types';
import { uniqBy } from 'lodash';

const ARGUMENT_PATTERN = /(?<=\{\{)([^}]+)(?=\})/g;
const ARGUMENT_TYPE_SUFFIX = '.Argument';

mustache.escape = (text) => {
  if (typeof text === 'string') {
    return text.replace(/"/g, `\\"`);
  } else {
    return text;
  }
};

@Injectable()
export class FunctionService {
  private readonly logger: Logger = new Logger(FunctionService.name);
  private readonly faasService: FaasService;

  constructor(
    private readonly commonService: CommonService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly eventService: EventService,
    private readonly aiService: AiService,
    @Inject(forwardRef(() => SpecsService))
    private readonly specsService: SpecsService,
  ) {
    this.faasService = new KNativeFaasService(config, httpService);
  }

  async getApiFunctions(environmentId: string, contexts?: string[], names?: string[], ids?: string[], includePublic = false) {
    return this.prisma.apiFunction.findMany({
      where: {
        OR: [
          { environmentId },
          includePublic ? { visibility: Visibility.Public } : {},
        ],
        ...this.getFunctionFilterConditions(contexts, names, ids),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findApiFunction(id: string) {
    return this.prisma.apiFunction.findFirst({
      where: {
        id,
      },
    });
  }

  apiFunctionToBasicDto(apiFunction: ApiFunction): FunctionBasicDto {
    return {
      id: apiFunction.id,
      name: apiFunction.name,
      context: apiFunction.context,
      description: apiFunction.description,
      visibility: apiFunction.visibility as Visibility,
    };
  }

  apiFunctionToDetailsDto(apiFunction: ApiFunction): FunctionDetailsDto {
    return {
      ...this.apiFunctionToBasicDto(apiFunction),
      arguments: this.getFunctionArguments(apiFunction),
    };
  }

  createApiFunction(data: Omit<Prisma.ApiFunctionCreateInput, 'createdAt'>): Promise<ApiFunction> {
    return this.prisma.apiFunction.create({
      data: {
        createdAt: new Date(),
        ...data,
      },
    });
  }

  async teach(
    id: string | null,
    environmentId: string,
    url: string,
    body: Body,
    requestName: string,
    name: string | null,
    context: string | null,
    description: string | null,
    payload: string | null,
    response: any,
    variables: Variables,
    statusCode: number,
    templateHeaders: Header[],
    method: Method,
    templateUrl: string,
    templateBody: Body,
    templateAuth?: Auth,
  ): Promise<TeachResponseDto> {
    if (!(statusCode >= HttpStatus.OK && statusCode < HttpStatus.AMBIGUOUS)) {
      throw new BadRequestException(
        `Api response status code should be between ${HttpStatus.OK} and ${HttpStatus.AMBIGUOUS}.`,
      );
    }

    let apiFunction: ApiFunction | null = null;

    const finalAuth = templateAuth ? JSON.stringify(templateAuth) : null;
    const finalBody = JSON.stringify(this.getBodyWithContentFiltered(templateBody));
    const finalHeaders = JSON.stringify(this.filterDisabledValues(templateHeaders));

    if (id === null) {
      const urlObject = new URL(templateUrl);

      const apiFunctions = await this.prisma.apiFunction.findMany({
        where: {
          environmentId,
          OR: [
            {
              url: {
                startsWith: `${urlObject.origin}${urlObject.pathname}?`,
              },
            },
            {
              url: templateUrl,
            },
          ],
          method,
        },
      });

      if (apiFunctions.length) {
        apiFunction = await this.findApiFunctionForRetraining(
          apiFunctions,
          finalBody,
          finalHeaders,
          templateUrl,
          variables,
          finalAuth,
        );
      }
    } else if (id !== 'new') {
      apiFunction = await this.prisma.apiFunction.findFirst({
        where: {
          id,
        },
      });

      if (!apiFunction) {
        throw new NotFoundException(`Function not found for id ${id}.`);
      }

      this.logger.debug(`Explicity retraining function with id ${id}.`);
    }

    const willRetrain = (id === null || id !== 'new') && apiFunction !== null;

    if (id === 'new') {
      this.logger.debug(`Explicity avoid retrain.`);
      this.logger.debug(`Creating a new poly function...`);
    }

    if (id === null && willRetrain && apiFunction) {
      this.logger.debug(`Found existing function ${apiFunction.id} for retraining. Updating...`);
    }

    if (id === null && !apiFunction) {
      this.logger.debug(`Creating new poly function...`);
    }

    response = this.commonService.trimDownObject(response, 1);

    if ((!name || !context || !description) && !willRetrain) {
      const {
        name: aiName,
        description: aiDescription,
        context: aiContext,
      } = await this.aiService.getFunctionDescription(
        url,
        apiFunction?.method || method,
        description || apiFunction?.description || '',
        JSON.stringify(this.commonService.trimDownObject(this.getBodyData(body))),
        JSON.stringify(response),
      );

      if (!name) {
        name = aiName;
      }
      if (!context && !apiFunction?.context) {
        context = aiContext;
      }
      if (!description && !apiFunction?.description) {
        description = aiDescription;
      }
    }

    if (apiFunction) {
      name = this.normalizeName(name, apiFunction);
      context = this.normalizeContext(context, apiFunction);
      description = this.normalizeDescription(description, apiFunction);
      payload = this.normalizePayload(payload, apiFunction);
    }

    this.logger.debug(
      `Normalized: name: ${name}, context: ${context}, description: ${description}, payload: ${payload}`,
    );

    const finalContext = context || '';
    const finalName = name?.trim() ? name : requestName;
    const finalDescription = description || '';

    if (!finalName) {
      throw new BadRequestException('Couldn\'t infer function name neither from user, ai service or postman request name.');
    }

    await this.throwErrIfInvalidResponse(response, payload, context || '', finalName);

    const upsertPayload = {
      context: finalContext,
      description: finalDescription,
      payload,
      response: JSON.stringify(response),
      body: finalBody,
      headers: finalHeaders,
      auth: finalAuth,
      url: templateUrl,
    };

    if (apiFunction && willRetrain) {
      const updatedApiFunction = await this.prisma.apiFunction.update({
        where: {
          id: apiFunction.id,
        },
        data: {
          ...upsertPayload,
          name: await this.resolveFunctionName(environmentId, finalName, finalContext, true, true, [apiFunction.id]),
          argumentsMetadata: await this.resolveArgumentsMetadata(
            {
              argumentsMetadata: apiFunction.argumentsMetadata,
              auth: finalAuth,
              body: finalBody,
              headers: finalHeaders,
              url: templateUrl,
              id: apiFunction.id,
            },
            variables,
          ),
        },
      });

      return {
        functionId: updatedApiFunction.id,
      };
    }

    const createdApiFunction = await this.prisma.apiFunction.create({
      data: {
        environment: {
          connect: {
            id: environmentId,
          },
        },
        ...upsertPayload,
        name: await this.resolveFunctionName(environmentId, finalName, finalContext, true, true),
        argumentsMetadata: await this.resolveArgumentsMetadata(
          {
            argumentsMetadata: null,
            url: templateUrl,
            auth: finalAuth,
            body: finalBody,
            headers: finalHeaders,
          },
          variables,
        ),
        method,
      },
    });

    return {
      functionId: createdApiFunction.id,
    };
  }

  async updateApiFunction(
    apiFunction: ApiFunction,
    name: string | null,
    context: string | null,
    description: string | null,
    argumentsMetadata: ArgumentsMetadata | null,
    response: any,
    payload: string | null,
    visibility: Visibility | null,
  ) {
    if (name != null || context != null) {
      name = name ? await this.resolveFunctionName(apiFunction.environmentId, name, apiFunction.context, false) : null;

      if (
        !(await this.checkContextAndNameDuplicates(apiFunction.environmentId, context == null
          ? apiFunction.context || ''
          : context, name || apiFunction.name, [apiFunction.id]))
      ) {
        throw new ConflictException(`Function with name ${name} and context ${context} already exists.`);
      }
    }

    if (argumentsMetadata != null) {
      this.checkArgumentsMetadata(apiFunction, argumentsMetadata);
      argumentsMetadata = await this.resolveArgumentsTypeDeclarations(apiFunction, argumentsMetadata);
    }

    argumentsMetadata = this.mergeArgumentsMetadata(apiFunction.argumentsMetadata, argumentsMetadata);

    const duplicatedArgumentName = this.findDuplicatedArgumentName(
      this.getFunctionArguments({
        ...apiFunction,
        argumentsMetadata: JSON.stringify(argumentsMetadata),
      }),
    );
    if (duplicatedArgumentName) {
      throw new ConflictException(`Function has duplicated arguments: ${duplicatedArgumentName}`);
    }

    this.logger.debug(
      `Updating URL function ${apiFunction.id} with name ${name}, context ${context}, description ${description}`,
    );

    const finalContext = context == null ? apiFunction.context : context;
    const finalName = name || apiFunction.name;

    await this.throwErrIfInvalidResponse(response, payload, finalContext, finalName);

    return this.prisma.apiFunction.update({
      where: {
        id: apiFunction.id,
      },
      data: {
        name: finalName,
        context: finalContext,
        description: description == null ? apiFunction.description : description,
        argumentsMetadata: JSON.stringify(argumentsMetadata),
        ...(response ? { response: JSON.stringify(response) } : null),
        visibility: visibility == null ? apiFunction.visibility : visibility,
      },
    });
  }

  async executeApiFunction(apiFunction: ApiFunction, args: Record<string, any>, clientID: string): Promise<ApiFunctionResponseDto | null> {
    this.logger.debug(`Executing function ${apiFunction.id} with arguments ${JSON.stringify(args)}`);

    const argumentsMap = this.getArgumentsMap(apiFunction, args);
    const url = mustache.render(apiFunction.url, argumentsMap);
    const method = apiFunction.method;
    const auth = apiFunction.auth ? JSON.parse(mustache.render(apiFunction.auth, argumentsMap)) : null;
    const body = JSON.parse(mustache.render(apiFunction.body || '{}', argumentsMap));
    const params = {
      ...this.getAuthorizationQueryParams(auth),
    };
    const headers = {
      ...JSON.parse(mustache.render(apiFunction.headers || '[]', argumentsMap)).reduce(
        (headers, header) => Object.assign(headers, { [header.key]: header.value }),
        {},
      ),
      ...this.getContentTypeHeaders(body),
      ...this.getAuthorizationHeaders(auth),
    };

    this.logger.debug(
      `Performing HTTP request ${method} ${url} (id: ${apiFunction.id})...\nHeaders:\n${JSON.stringify(
        headers,
      )}\nBody:\n${JSON.stringify(body)}`,
    );

    return lastValueFrom(
      this.httpService
        .request({
          url,
          method,
          headers,
          params,
          data: this.getBodyData(body),
        })
        .pipe(
          map((response) => {
            const processData = () => {
              try {
                const payloadResponse = this.commonService.getPathContent(response.data, apiFunction.payload);
                if (response.data !== payloadResponse) {
                  this.logger.debug(
                    `Payload response (id: ${apiFunction.id}, payload: ${apiFunction.payload}):\n${JSON.stringify(
                      payloadResponse,
                    )}`,
                  );
                }
                return payloadResponse;
              } catch (e) {
                return response;
              }
            };

            this.logger.debug(`Raw response (id: ${apiFunction.id}):\nStatus: ${response.status}\n${JSON.stringify(response.data)}`);

            return {
              status: response.status,
              headers: response.headers,
              data: processData(),
            } as ApiFunctionResponseDto;
          }),
        )
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Error while performing HTTP request (id: ${apiFunction.id}): ${error}`);

            const functionPath = `${apiFunction.context ? `${apiFunction.context}.` : ''}${apiFunction.name}`;
            if (this.eventService.sendErrorEvent(clientID, functionPath, this.eventService.getEventError(error))) {
              return of(null);
            }

            if (error.response) {
              throw new HttpException(error.response.data as any, error.response.status);
            } else {
              throw new InternalServerErrorException(error.message);
            }
          }),
        ),
    );
  }

  async deleteApiFunction(id: string) {
    this.logger.debug(`Deleting URL function ${id}`);
    await this.prisma.apiFunction.delete({
      where: {
        id,
      },
    });
  }

  async toApiFunctionSpecification(apiFunction: ApiFunction): Promise<Specification> {
    const functionArguments = this.getFunctionArguments(apiFunction);
    const requiredArguments = functionArguments.filter((arg) => !arg.payload && arg.required);
    const optionalArguments = functionArguments.filter((arg) => !arg.payload && !arg.required);
    const payloadArguments = functionArguments.filter((arg) => arg.payload);

    const toPropertySpecification = async (arg: FunctionArgument): Promise<PropertySpecification> => ({
      name: arg.name,
      required: arg.required == null ? true : arg.required,
      type: await this.toPropertyType(arg.name, arg.type, arg.typeObject),
    });

    const getReturnType = async () => {
      const responseObject = apiFunction.response
        ? this.commonService.getPathContent(JSON.parse(apiFunction.response), apiFunction.payload)
        : null;
      const [type, typeSchema] = responseObject
        ? await this.commonService.resolveType('ReturnType', JSON.stringify(responseObject))
        : ['void'];
      return {
        ...await this.toPropertyType('ReturnType', type),
        schema: typeSchema,
      };
    };

    return {
      id: apiFunction.id,
      type: 'apiFunction',
      context: apiFunction.context,
      name: toCamelCase(apiFunction.name),
      description: apiFunction.description,
      function: {
        arguments: [
          ...(await Promise.all(requiredArguments.map(toPropertySpecification))),
          ...(
            payloadArguments.length > 0
              ? [{
                name: 'payload',
                required: true,
                type: {
                  kind: 'object',
                  properties: await Promise.all(payloadArguments.map(toPropertySpecification)),
                },
              }]
              : []
          ),
          ...(await Promise.all(optionalArguments.map(toPropertySpecification))),
        ] as PropertySpecification[],
        returnType: await getReturnType(),
      },
    };
  }

  async getCustomFunctions(environmentId: string, contexts?: string[], names?: string[], ids?: string[], includePublic = false) {
    return this.prisma.customFunction.findMany({
      where: {
        OR: [
          { environmentId },
          includePublic ? { visibility: Visibility.Public } : {},
        ],
        ...this.getFunctionFilterConditions(contexts, names, ids),
      },
    });
  }

  customFunctionToBasicDto(customFunction: CustomFunction): FunctionBasicDto {
    return {
      id: customFunction.id,
      name: customFunction.name,
      description: customFunction.description,
      context: customFunction.context,
      visibility: customFunction.visibility as Visibility,
    };
  }

  customFunctionToDetailsDto(customFunction: CustomFunction): FunctionDetailsDto {
    return {
      ...this.customFunctionToBasicDto(customFunction),
      arguments: JSON.parse(customFunction.arguments).map((arg) => ({
        ...arg,
        required: arg.required == null ? true : arg.required,
        secure: arg.secure == null ? false : arg.secure,
      })),
    };
  }

  async createCustomFunction(env: Environment, context: string, name: string, customCode: string, serverFunction: boolean, apiKey: string) {
    const {
      code,
      args,
      returnType,
      contextChain,
      requirements,
    } = transpileCode(name, customCode);

    context = context || contextChain.join('.');

    let customFunction = await this.prisma.customFunction.findFirst({
      where: {
        environmentId: env.id,
        name,
        context,
      },
    });

    if (customFunction) {
      this.logger.debug(`Updating custom function ${name} with context ${context}, imported libraries: [${[...requirements].join(', ')}], code:\n${code}`);
      customFunction = await this.prisma.customFunction.update({
        where: {
          id: customFunction.id,
        },
        data: {
          code,
          arguments: JSON.stringify(args),
          returnType,
          requirements: JSON.stringify(requirements),
        },
      });
    } else {
      this.logger.debug(`Creating custom function ${name} with context ${context}, imported libraries: [${[...requirements].join(', ')}], code:\n${code}`);
      customFunction = await this.prisma.customFunction.create({
        data: {
          environment: {
            connect: {
              id: env.id,
            },
          },
          context,
          name,
          code,
          arguments: JSON.stringify(args),
          returnType,
          requirements: JSON.stringify(requirements),
        },
      });
    }

    if (serverFunction) {
      this.logger.debug(`Creating server side custom function ${name}`);

      try {
        await this.faasService.createFunction(customFunction.id, name, code, requirements, apiKey);
        customFunction = await this.prisma.customFunction.update({
          where: {
            id: customFunction.id,
          },
          data: {
            serverSide: true,
          },
        });
      } catch (e) {
        this.logger.error(
          `Error creating server side custom function ${name}: ${e.message}. Function created as client side.`,
        );
        throw e;
      }
    }

    return customFunction;
  }

  async updateCustomFunction(customFunction: CustomFunction, name: string | null, context: string | null, description: string | null, visibility: Visibility | null) {
    const { id, name: currentName, context: currentContext } = customFunction;

    if (context != null || name != null) {
      if (!(await this.checkContextAndNameDuplicates(customFunction.environmentId, context || currentContext, name || currentName, [id]))) {
        throw new ConflictException(`Function with name ${name} and context ${context} already exists.`);
      }
    }

    this.logger.debug(
      `Updating custom function ${id} with name ${name}, context ${context}, description ${description}`,
    );
    return this.prisma.customFunction.update({
      where: {
        id,
      },
      data: {
        name: name == null ? customFunction.name : name,
        context: context == null ? customFunction.context : context,
        description: description == null ? customFunction.description : description,
        visibility: visibility == null ? customFunction.visibility : visibility,
      },
    });
  }

  async deleteCustomFunction(id: string) {
    this.logger.debug(`Deleting custom function ${id}`);
    await this.prisma.customFunction.delete({
      where: {
        id,
      },
    });
  }

  async getClientFunctions(environmentId: string, contexts?: string[], names?: string[], ids?: string[]) {
    return this.prisma.customFunction.findMany({
      where: {
        OR: [
          { environmentId },
          { visibility: Visibility.Public },
        ],
        ...this.getFunctionFilterConditions(contexts, names, ids),
        serverSide: false,
      },
    });
  }

  async findClientFunction(id: string) {
    return this.prisma.customFunction.findFirst({
      where: {
        id,
        serverSide: false,
      },
    });
  }

  async getServerFunctions(environmentId: string, contexts?: string[], names?: string[], ids?: string[]) {
    return this.prisma.customFunction.findMany({
      where: {
        OR: [
          { environmentId },
          { visibility: Visibility.Public },
        ],
        ...this.getFunctionFilterConditions(contexts, names, ids),
        serverSide: true,
      },
    });
  }

  async findServerFunction(id: string) {
    return this.prisma.customFunction.findFirst({
      where: {
        id,
        serverSide: true,
      },
    });
  }

  async executeServerFunction(customFunction: CustomFunction, args: Record<string, any>, clientID: string) {
    this.logger.debug(`Executing server function ${customFunction.id} with arguments ${JSON.stringify(args)}`);

    const functionArguments = JSON.parse(customFunction.arguments || '[]');
    const argumentsList = functionArguments.map((arg: FunctionArgument) => args[arg.key]);

    try {
      const result = await this.faasService.executeFunction(customFunction.id, argumentsList);
      this.logger.debug(
        `Server function ${customFunction.id} executed successfully with result: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Error executing server function ${customFunction.id}: ${error.message}`);
      const functionPath = `${customFunction.context ? `${customFunction.context}.` : ''}${customFunction.name}`;
      if (this.eventService.sendErrorEvent(clientID, functionPath, this.eventService.getEventError(error))) {
        return;
      }

      throw new InternalServerErrorException((error.response?.data as any)?.message || error.message);
    }
  }

  async updateAllServerFunctions(environment: Environment, apiKey: string) {
    this.logger.debug(`Updating all server functions in environment ${environment.id}...`);
    const serverFunctions = await this.prisma.customFunction.findMany({
      where: {
        environmentId: environment.id,
        serverSide: true,
      },
    });

    for (const serverFunction of serverFunctions) {
      this.logger.debug(`Updating server function ${serverFunction.id}...`);
      await this.faasService.updateFunction(serverFunction.id, JSON.parse(serverFunction.requirements || '[]'), apiKey);
    }
  }

  async toCustomFunctionSpecification(customFunction: CustomFunction): Promise<CustomFunctionSpecification | ServerFunctionSpecification> {
    const parsedArguments = JSON.parse(customFunction.arguments || '[]');

    const toArgumentSpecification = async (arg: FunctionArgument): Promise<PropertySpecification> => ({
      name: arg.name,
      required: typeof arg.required === 'undefined' ? true : arg.required,
      type: {
        kind: 'plain',
        value: arg.type,
      },
    });

    return {
      id: customFunction.id,
      type: customFunction.serverSide ? 'serverFunction' : 'customFunction',
      context: customFunction.context,
      name: customFunction.name,
      description: customFunction.description,
      requirements: JSON.parse(customFunction.requirements || '[]'),
      function: {
        arguments: await Promise.all(parsedArguments.map(toArgumentSpecification)),
        returnType: customFunction.returnType
          ? {
            kind: 'plain',
            value: customFunction.returnType,
          }
          : {
            kind: 'void',
          },
      },
      code: customFunction.code,
    };
  }

  private filterDisabledValues<T extends PostmanVariableEntry>(values: T[]) {
    return values.filter(({ disabled }) => !disabled);
  }

  private getBodyWithContentFiltered(body: Body): Body {
    switch (body.mode) {
      case 'formdata':
        return {
          ...body,
          formdata: this.filterDisabledValues(body.formdata),
        };
      case 'urlencoded':
        return {
          ...body,
          urlencoded: this.filterDisabledValues(body.urlencoded),
        };
      default:
        return body;
    }
  }

  private getFunctionArguments(apiFunction: ApiFunctionArguments): FunctionArgument[] {
    const toArgument = (arg: string) => this.toArgument(arg, JSON.parse(apiFunction.argumentsMetadata || '{}'));
    const args: FunctionArgument[] = [];

    args.push(...(apiFunction.url.match(ARGUMENT_PATTERN)?.map<FunctionArgument>(arg => ({
      ...toArgument(arg),
      location: 'url',
    })) || []));
    args.push(...(apiFunction.headers?.match(ARGUMENT_PATTERN)?.map<FunctionArgument>(arg => ({
      ...toArgument(arg),
      location: 'headers',
    })) || []));
    args.push(...(apiFunction.auth?.match(ARGUMENT_PATTERN)?.map<FunctionArgument>(arg => ({
      ...toArgument(arg),
      location: 'auth',
    })) || []));

    const bodyArgs = (apiFunction.body?.match(ARGUMENT_PATTERN)?.map<FunctionArgument>(arg => ({
      ...toArgument(arg),
      location: 'body',
    })) || []).filter(bodyArg => !args.some(arg => arg.key === bodyArg.key));

    args.push(...bodyArgs);

    args.sort(compareArgumentsByRequired);

    return uniqBy(args, 'key');
  }

  private toArgument(argument: string, argumentsMetadata: ArgumentsMetadata): FunctionArgument {
    return {
      key: argument,
      name: argumentsMetadata[argument]?.name || argument,
      type: argumentsMetadata[argument]?.type || 'string',
      typeObject: argumentsMetadata[argument]?.typeObject,
      payload: argumentsMetadata[argument]?.payload || false,
      required: argumentsMetadata[argument]?.required !== false,
      secure: argumentsMetadata[argument]?.secure || false,
    };
  }

  private getArgumentsMap(apiFunction: ApiFunction, args: Record<string, any>) {
    const normalizeArg = (arg: any) => {
      if (typeof arg === 'string') {
        return arg
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
          .replace(/\f/g, '\\f')
          .replace(/\b/g, '')
          .trim();
      } else if (typeof arg === 'object') {
        return JSON.stringify(arg);
      } else {
        return arg;
      }
    };

    const functionArgs = this.getFunctionArguments(apiFunction);
    const getPayloadArgs = () => {
      const payloadArgs = functionArgs.filter((arg) => arg.payload);
      if (payloadArgs.length === 0) {
        return {};
      }
      const payload = args['payload'];
      if (typeof payload !== 'object') {
        this.logger.debug(`Expecting payload as object, but it is not: ${JSON.stringify(payload)}`);
        return {};
      }
      return payloadArgs.reduce(
        (result, arg) => Object.assign(result, { [arg.key]: normalizeArg(payload[arg.name]) }),
        {},
      );
    };

    return {
      ...functionArgs
        .filter((arg) => !arg.payload)
        .reduce((result, arg) => Object.assign(result, { [arg.key]: normalizeArg(args[arg.name]) }), {}),
      ...getPayloadArgs(),
    };
  }

  private getFunctionFilterConditions(contexts?: string[], names?: string[], ids?: string[]) {
    const contextConditions = contexts?.length
      ? contexts.filter(Boolean).map((context) => {
        return {
          OR: [
            {
              context: { startsWith: `${context}.` },
            },
            {
              context,
            },
          ],
        };
      })
      : [];

    const filterConditions = [
      ...contextConditions,
      names?.length ? { name: { in: names } } : undefined,
      ids?.length ? { id: { in: ids } } : undefined,
    ].filter(Boolean) as any[];

    if (filterConditions.length > 0) {
      this.logger.debug(`functions filterConditions: ${JSON.stringify(filterConditions)}`);
    }

    return filterConditions.length > 0 ? { OR: filterConditions } : {};
  }

  private async resolveFunctionName(
    environmentId: string,
    name: string,
    context: string,
    transformTextCase = true,
    fixDuplicate = false,
    excludedIds?: string[],
  ) {
    if (transformTextCase) {
      name = name.replace(/([\[\]\\/{}()])/g, ' ');
      name = toCamelCase(name);
    }

    if (!fixDuplicate) {
      return name;
    }

    const originalName = name;
    let nameIdentifier = 1;
    while (!(await this.checkContextAndNameDuplicates(environmentId, context, name, excludedIds))) {
      name = `${originalName}${nameIdentifier++}`;
      if (nameIdentifier > 100) {
        throw new BadRequestException(`Failed to create poly function: unambiguous function name`);
      }
    }

    return name;
  }

  private getAuthorizationHeaders(auth: Auth | null) {
    if (!auth) {
      return {};
    }

    switch (auth.type) {
      case 'basic': {
        const username = auth.basic.find((item) => item.key === 'username')?.value;
        const password = auth.basic.find((item) => item.key === 'password')?.value;

        return {
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        };
      }
      case 'bearer': {
        const token = auth.bearer.find((item) => item.key === 'token')?.value;

        return {
          Authorization: `Bearer ${token}`,
        };
      }
      case 'apikey': {
        const inHeader = auth.apikey.find((item) => item.key === 'in')?.value === 'header';
        if (!inHeader) {
          return {};
        }

        const key = auth.apikey.find((item) => item.key === 'key')!.value;
        const value = auth.apikey.find((item) => item.key === 'value')!.value;

        return {
          [key]: value,
        };
      }
      default:
        this.logger.debug(`Unknown auth type:`, auth);
        return {};
    }
  }

  private getAuthorizationQueryParams(auth: Auth | null) {
    if (!auth) {
      return {};
    }

    switch (auth.type) {
      case 'apikey': {
        const inQuery = auth.apikey.find((item) => item.key === 'in')?.value === 'query';
        if (!inQuery) {
          return {};
        }

        const key = auth.apikey.find((item) => item.key === 'key')!.value;
        const value = auth.apikey.find((item) => item.key === 'value')!.value;

        return {
          [key]: value,
        };
      }
      default:
        return {};
    }
  }

  private getBodyData(body: Body): any | undefined {
    switch (body.mode) {
      case 'raw':
        if (!body.raw?.trim()) {
          return undefined;
        }
        try {
          return JSON.parse(
            body.raw.replace(/\n/g, '').replace(/\r/g, '').replace(/\t/g, '').replace(/\f/g, '').replace(/\b/g, ''),
          );
        } catch (e) {
          this.logger.debug(`Error while parsing body: ${e}`);
          return body.raw;
        }
      case 'formdata':
        return body.formdata.reduce((data, item) => Object.assign(data, { [item.key]: item.value }), {});
      case 'urlencoded':
        return body.urlencoded.reduce((data, item) => Object.assign(data, { [item.key]: item.value }), {});
      default:
        return undefined;
    }
  }

  private getContentTypeHeaders(body: Body) {
    switch (body.mode) {
      case 'raw':
        return {
          'Content-Type': 'application/json',
        };
      case 'formdata':
        return {
          'Content-Type': 'multipart/form-data',
        };
      case 'urlencoded':
        return {
          'Content-Type': 'application/x-www-form-urlencoded',
        };
      default:
        return {};
    }
  }

  private async checkContextAndNameDuplicates(environmentId: string, context: string, name: string, excludedIds?: string[]) {
    const functionPath = `${context ? `${context}.` : ''}${name.split('.').map(toCamelCase).join('.')}`;
    const paths = (await this.specsService.getSpecificationPaths(environmentId))
      .filter(path => excludedIds == null || !excludedIds.includes(path.id))
      .map(path => path.path);

    return !paths.includes(functionPath);
  }

  private normalizeName(name: string | null, apiFunction: ApiFunction) {
    if (name == null) {
      name = apiFunction.name;
    }
    return name;
  }

  private normalizeContext(context: string | null, apiFunction: ApiFunction) {
    if (context == null) {
      context = apiFunction.context;
    }

    return context;
  }

  private normalizeDescription(description: string | null, apiFunction: ApiFunction) {
    if (description == null) {
      description = apiFunction.description;
    }

    return description;
  }

  private normalizePayload(payload: string | null, apiFunction: ApiFunction) {
    if (payload == null) {
      payload = apiFunction.payload;
    } else {
      if (!payload.startsWith('$')) {
        payload = `$${payload.startsWith('[') ? '' : '.'}${payload}`;
      }
    }

    return payload;
  }

  private async toPropertyType(name: string, type: ArgumentType, typeObject?: object): Promise<PropertyType> {
    if (type.endsWith('[]')) {
      return {
        kind: 'array',
        items: await this.toPropertyType(name, type.substring(0, type.length - 2)),
      };
    }
    if (type.endsWith(ARGUMENT_TYPE_SUFFIX)) {
      // backward compatibility (might be removed in the future)
      type = 'object';
    }

    switch (type) {
      case 'string':
      case 'number':
      case 'boolean':
        return {
          kind: 'primitive',
          type,
        };
      case 'void':
        return {
          kind: 'void',
        };
      case 'object':
        if (typeObject) {
          const schema = await this.commonService.getJsonSchema(toPascalCase(name), typeObject);
          return {
            kind: 'object',
            schema: schema || undefined,
          };
        } else {
          return {
            kind: 'object',
          };
        }
      default:
        return {
          kind: 'plain',
          value: type,
        };
    }
  }

  private findDuplicatedArgumentName(args: FunctionArgument[]) {
    const names = new Set<string>();

    for (const argument of args) {
      const name = toCamelCase(argument.name);
      if (names.has(name)) {
        return name;
      }
      names.add(name);
    }
    return null;
  }

  private async resolveArgumentsMetadata(
    apiFunction: ApiFunctionArguments & Partial<Pick<ApiFunction, 'id'>>,
    variables: Variables,
    debug?: boolean,
  ) {
    const functionArgs = this.getFunctionArguments(apiFunction);
    const newMetadata: ArgumentsMetadata = {};
    const metadata: ArgumentsMetadata = JSON.parse(apiFunction.argumentsMetadata || '{}');

    const resolveArgumentParameterLimit = () => {
      if (apiFunction.argumentsMetadata || functionArgs.length <= this.config.functionArgsParameterLimit) {
        return;
      }

      if (debug) {
        this.logger.debug(
          `Generating arguments metadata for ${
            apiFunction.id ? `function ${apiFunction.id}` : 'a new function'
          } with payload 'true' (arguments count: ${functionArgs.length})`,
        );
      }

      functionArgs.forEach((arg) => {
        if (arg.location === 'body') {
          if (metadata[arg.key]) {
            metadata[arg.key].payload = true;
          } else {
            metadata[arg.key] = {
              payload: true,
            };
          }
        }
      });
    };
    const resolveArgumentTypes = async () => {
      if (debug) {
        if (apiFunction.id) {
          this.logger.debug(`Resolving argument types for function ${apiFunction.id}...`);
        } else {
          this.logger.debug(`Resolving argument types for new function...`);
        }
      }

      for (const arg of functionArgs) {
        if (metadata[arg.key]?.type) {
          newMetadata[arg.key] = metadata[arg.key];
          continue;
        }
        const value = variables[arg.key];

        if (value == null) {
          newMetadata[arg.key] = metadata[arg.key];
          continue;
        }

        const [type, typeSchema] = await this.resolveArgumentType(value);

        if (newMetadata[arg.key]) {
          newMetadata[arg.key].type = type;
          newMetadata[arg.key].typeSchema = typeSchema;
        } else {
          newMetadata[arg.key] = {
            type,
            typeSchema,
          };
        }
      }
    };

    resolveArgumentParameterLimit();

    await resolveArgumentTypes();

    return JSON.stringify(newMetadata);
  }

  private async resolveArgumentType(value: string) {
    return this.commonService.resolveType('Argument', value);
  }

  private async resolveArgumentsTypeDeclarations(apiFunction: ApiFunction, argumentsMetadata: ArgumentsMetadata) {
    for (const argKey of Object.keys(argumentsMetadata)) {
      const argMetadata = argumentsMetadata[argKey];
      if (argMetadata.type === 'object') {
        if (!argMetadata.typeObject) {
          throw new BadRequestException(`Argument '${argKey}' with type='object' is missing typeObject value`);
        }
        if (typeof argMetadata.typeObject !== 'object') {
          throw new BadRequestException(
            `Argument '${argKey}' with type='object' has invalid typeObject value (must be 'object' type)`,
          );
        }

        const [type, typeSchema] = await this.resolveArgumentType(JSON.stringify(argMetadata.typeObject));
        argMetadata.type = type;
        argMetadata.typeSchema = typeSchema;
      }
    }

    return argumentsMetadata;
  }

  private checkArgumentsMetadata(apiFunction: ApiFunction, argumentsMetadata: ArgumentsMetadata) {
    const functionArgs = this.getFunctionArguments(apiFunction);

    Object.keys(argumentsMetadata).forEach((key) => {
      if (!functionArgs.find((arg) => arg.key === key)) {
        throw new BadRequestException(`Argument '${key}' not found in function`);
      }
    });
  }

  private mergeArgumentsMetadata(argumentsMetadata: string | null, updatedArgumentsMetadata: ArgumentsMetadata | null) {
    return mergeWith(JSON.parse(argumentsMetadata || '{}'), updatedArgumentsMetadata || {}, (objValue, srcValue) => {
      if (objValue?.typeObject && srcValue?.typeObject) {
        return {
          ...objValue,
          ...srcValue,
          typeObject: srcValue.typeObject,
        };
      }
    });
  }

  private async throwErrIfInvalidResponse(response: any, payload: string | null, context: string, name: string) {
    try {
      const content = this.commonService.getPathContent(response, payload);

      const responseType = await this.commonService.generateTypeDeclaration(
        'ResponseType',
        content,
        toPascalCase(`${context} ${name}`),
      );
      this.logger.debug(`Generated response type:\n${responseType}`);
    } catch (e) {
      if (e instanceof PathError) {
        throw new BadRequestException(e.message);
      } else {
        throw e;
      }
    }
  }

  private async findApiFunctionForRetraining(
    apiFunctions: ApiFunction[],
    body: string,
    headers: string,
    url: string,
    variables: Variables,
    auth: string | null,
  ): Promise<ApiFunction | null> {
    let apiFunction: ApiFunction | null = null;

    for await (const currentApiFunction of apiFunctions) {
      const newArgumentsMetaData = await this.resolveArgumentsMetadata(
        {
          argumentsMetadata: currentApiFunction.argumentsMetadata,
          auth,
          body,
          headers,
          url,
          id: currentApiFunction.id,
        },
        variables,
      );

      const parsedCurrentArgumentsMetaData = JSON.parse(
        currentApiFunction.argumentsMetadata || '{}',
      ) as ArgumentsMetadata;
      const parsedNewArgumentsMetaData = JSON.parse(newArgumentsMetaData) as ArgumentsMetadata;

      // Check arguments length difference.
      if (Object.keys(parsedCurrentArgumentsMetaData).length !== Object.keys(parsedNewArgumentsMetaData).length) {
        continue;
      }

      // Check arguments type difference.
      if (
        !Object.keys(parsedCurrentArgumentsMetaData).every((key) => {
          return (
            parsedNewArgumentsMetaData.hasOwnProperty(key) &&
            parsedCurrentArgumentsMetaData[key].type === parsedNewArgumentsMetaData[key].type
          );
        })
      ) {
        continue;
      }

      apiFunction = currentApiFunction;
      break;
    }

    return apiFunction;
  }
}
