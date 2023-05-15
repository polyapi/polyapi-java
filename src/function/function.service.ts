import ts, { factory } from 'typescript';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { CustomFunction, Prisma, SystemPrompt, ApiFunction, User } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import {
  ArgumentsMetadata,
  ArgumentType,
  Auth,
  Body,
  CustomFunctionSpecification,
  FunctionArgument,
  FunctionBasicDto,
  FunctionDetailsDto,
  Header,
  Method,
  PropertySpecification,
  PropertyType,
  Role,
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

  create(data: Omit<Prisma.ApiFunctionCreateInput, 'createdAt'>): Promise<ApiFunction> {
    return this.prisma.apiFunction.create({
      data: {
        createdAt: new Date(),
        ...data,
      },
    });
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
      ids?.length ? { publicId: { in: ids } } : undefined,
    ].filter(Boolean) as any[];

    if (filterConditions.length > 0) {
      this.logger.debug(`functions filterConditions: ${JSON.stringify(filterConditions)}`);
    }

    return filterConditions.length > 0 ? { OR: filterConditions } : {};
  }

  async getApiFunctions(user: User, contexts?: string[], names?: string[], ids?: string[]) {
    return this.prisma.apiFunction.findMany({
      where: {
        user: { id: user.id },
        ...this.getFunctionFilterConditions(contexts, names, ids),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async getCustomFunctions(user: User, contexts?: string[], names?: string[], ids?: string[]) {
    return this.prisma.customFunction.findMany({
      where: {
        user: { id: user.id },
        ...this.getFunctionFilterConditions(contexts, names, ids),
      },
    });
  }

  private async resolveFunctionName(
    user: User,
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
    while (!(await this.checkContextAndNameDuplicates(user, context, name, excludedIds))) {
      name = `${originalName}${nameIdentifier++}`;
      if (nameIdentifier > 100) {
        throw new BadRequestException(`Failed to create poly function: unambiguous function name`);
      }
    }

    return name;
  }

  private filterDisabledValues<T extends { [k: string]: string | boolean }>(values: T[]) {
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

  async teach(
    user: User,
    url: string,
    body: Body,
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

    const apiFunction = await this.prisma.apiFunction.findFirst({
      where: {
        user: {
          id: user.id,
        },
        url: templateUrl,
        method,
      },
    });

    response = this.commonService.trimDownObject(response, 1);

    if (!name || !context || !description) {
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
      this.logger.debug(`Found existing URL function ${apiFunction.id}. Updating...`);

      name = this.normalizeName(name, apiFunction);
      context = this.normalizeContext(context, apiFunction);
      description = this.normalizeDescription(description, apiFunction);
      payload = this.normalizePayload(payload, apiFunction);
    } else {
      this.logger.debug(`Creating new poly function...`);
    }

    this.logger.debug(
      `Normalized: name: ${name}, context: ${context}, description: ${description}, payload: ${payload}`,
    );

    await this.throwErrIfInvalidResponse(response, payload, context || '', name);

    const finalAuth = templateAuth ? JSON.stringify(templateAuth) : null;
    const finalBody = JSON.stringify(this.getBodyWithContentFiltered(templateBody));
    const finalHeaders = JSON.stringify(this.filterDisabledValues(templateHeaders));

    const finalContext = context || '';

    const createOrUpdatePayload = {
      context: finalContext,
      description: description || '',
      payload,
      response: JSON.stringify(response),
      body: finalBody,
      headers: finalHeaders,
      auth: finalAuth,
    };

    if (apiFunction) {
      const updatedApiFunction = await this.prisma.apiFunction.update({
        where: {
          id: apiFunction.id,
        },
        data: {
          name: await this.resolveFunctionName(user, name, finalContext, true, true, [apiFunction.publicId]),
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
          ...createOrUpdatePayload,
        },
      });

      return {
        functionId: updatedApiFunction.id,
      };
    }

    const createdApiFunction = await this.prisma.apiFunction.create({
      data: {
        user: {
          connect: {
            id: user.id,
          },
        },
        name: await this.resolveFunctionName(user, name, finalContext, true, true),
        argumentsMetadata: await this.resolveArgumentsMetadata(
          {
            url: templateUrl,
            argumentsMetadata: null,
            auth: finalAuth,
            body: finalBody,
            headers: finalHeaders,
          },
          variables,
        ),
        ...createOrUpdatePayload,
        url: templateUrl,
        method,
      },
    });

    return {
      functionId: createdApiFunction.id,
    };
  }

  getFunctionArguments(apiFunction: ApiFunctionArguments): FunctionArgument[] {
    const toArgument = (arg: string) => this.toArgument(arg, JSON.parse(apiFunction.argumentsMetadata || '{}'));
    const args: FunctionArgument[] = [];

    args.push(...(apiFunction.url.match(ARGUMENT_PATTERN)?.map(toArgument) || []));
    args.push(...(apiFunction.headers?.match(ARGUMENT_PATTERN)?.map(toArgument) || []));
    args.push(...(apiFunction.body?.match(ARGUMENT_PATTERN)?.map(toArgument) || []));
    args.push(...(apiFunction.auth?.match(ARGUMENT_PATTERN)?.map(toArgument) || []));

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

  apiFunctionToBasicDto(apiFunction: ApiFunction): FunctionBasicDto {
    return {
      id: apiFunction.publicId,
      name: apiFunction.name,
      context: apiFunction.context,
      description: apiFunction.description,
    };
  }

  apiFunctionToDetailsDto(apiFunction: ApiFunction): FunctionDetailsDto {
    return {
      ...this.apiFunctionToBasicDto(apiFunction),
      arguments: this.getFunctionArguments(apiFunction),
      type: 'api',
    };
  }

  customFunctionToBasicDto(customFunction: CustomFunction): FunctionBasicDto {
    return {
      id: customFunction.publicId,
      name: customFunction.name,
      description: customFunction.description,
      context: customFunction.context,
    };
  }

  customFunctionToDetailsDto(customFunction: CustomFunction): FunctionDetailsDto {
    return {
      ...this.customFunctionToBasicDto(customFunction),
      arguments: JSON.parse(customFunction.arguments),
      type: customFunction.serverSide ? 'server' : 'client',
    };
  }

  async findApiFunctionByPublicId(publicId: string): Promise<ApiFunction | null> {
    return this.prisma.apiFunction.findFirst({
      where: {
        publicId,
      },
    });
  }

  async executeApiFunction(apiFunction: ApiFunction, args: Record<string, any>, clientID: string) {
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
          map((response) => response.data),
          map((response) => {
            try {
              this.logger.debug(`Response (id: ${apiFunction.id}):\n${JSON.stringify(response)}`);
              const payloadResponse = this.commonService.getPathContent(response, apiFunction.payload);
              if (response !== payloadResponse) {
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

  async findApiFunction(user: User, publicId: string) {
    return this.prisma.apiFunction.findFirst({
      where: {
        user: {
          id: user.id,
        },
        publicId,
      },
    });
  }

  async findClientFunction(user: User, publicId: string) {
    return this.prisma.customFunction.findFirst({
      where: {
        user: {
          id: user.id,
        },
        publicId,
        serverSide: false,
      },
    });
  }

  async findServerFunction(user: User, publicId: string) {
    return this.prisma.customFunction.findFirst({
      where: {
        user: {
          id: user.id,
        },
        publicId,
        serverSide: true,
      },
    });
  }

  async updateApiFunction(
    user: User,
    apiFunction: ApiFunction,
    name: string | null,
    context: string | null,
    description: string | null,
    argumentsMetadata: ArgumentsMetadata | null,
    response: any,
    payload: string | null,
  ) {
    if (name != null || context != null) {
      name = name ? await this.resolveFunctionName(user, name, apiFunction.context, false) : null;

      if (
        !(await this.checkContextAndNameDuplicates(
          user,
          context == null ? apiFunction.context || '' : context,
          name || apiFunction.name,
          [apiFunction.publicId],
        ))
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
      },
    });
  }

  async deleteApiFunction(user: User, publicId: string) {
    const apiFunction = await this.prisma.apiFunction.findFirst({
      where: {
        publicId,
      },
    });
    if (apiFunction) {
      if (user.role !== Role.Admin && apiFunction.userId !== user.id) {
        throw new ForbiddenException(`You don't have permission to delete this function.`);
      }

      this.logger.debug(`Deleting URL function ${publicId}`);
      await this.prisma.apiFunction.delete({
        where: {
          publicId,
        },
      });
      return;
    }

    throw new NotFoundException(`Function not found.`);
  }

  async updateCustomFunction(
    user: User,
    customFunction: CustomFunction,
    context: string | null,
    description: string | null,
  ) {
    const { id, publicId, name } = customFunction;

    if (context != null) {
      if (!(await this.checkContextAndNameDuplicates(user, context, name, [publicId]))) {
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
        context: context == null ? customFunction.context : context,
        description: description == null ? customFunction.description : description,
      },
    });
  }

  async deleteCustomFunction(user: User, publicId: string) {
    const customFunction = await this.prisma.customFunction.findFirst({
      where: {
        user: {
          id: user.id,
        },
        publicId,
      },
    });
    if (customFunction) {
      if (user.role !== Role.Admin && customFunction.userId !== user.id) {
        throw new ForbiddenException(`You don't have permission to delete this function.`);
      }

      this.logger.debug(`Deleting custom function ${publicId}`);
      await this.prisma.customFunction.delete({
        where: {
          publicId,
        },
      });
      return;
    }
  }

  private async checkContextAndNameDuplicates(user: User, context: string, name: string, excludedIds?: string[]) {
    const functionPath = `${context ? `${context}.` : ''}${name.split('.').map(toCamelCase).join('.')}`;
    const paths = (await this.specsService.getSpecificationPaths(user))
      .filter((path) => excludedIds == null || !excludedIds.includes(path.id))
      .map((path) => path.path);

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

  async deleteAllByUser(userID: number) {
    await this.prisma.apiFunction.deleteMany({
      where: {
        user: {
          id: userID,
        },
      },
    });
    await this.prisma.customFunction.deleteMany({
      where: {
        user: {
          id: userID,
        },
      },
    });
  }

  async deleteAllApiKey(apiKey: string) {
    await this.prisma.apiFunction.deleteMany({
      where: {
        user: {
          apiKey,
        },
      },
    });
    await this.prisma.customFunction.deleteMany({
      where: {
        user: {
          apiKey,
        },
      },
    });
  }

  async createCustomFunction(user: User, context: string, name: string, code: string, serverFunction: boolean) {
    let functionArguments: FunctionArgument[] | null = null;
    let returnType: string | null = null;
    const contextChain: string[] = [];

    const result = ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        noImplicitUseStrict: true,
      },
      fileName: 'customFunction.ts',
      transformers: {
        before: [
          (context) => {
            return (sourceFile) => {
              let fnDelaration: ts.MethodDeclaration | ts.FunctionDeclaration | null = null;

              const visitor = (node: ts.Node): ts.Node => {
                if (returnType !== null) {
                  return node;
                }

                if (ts.isExportAssignment(node)) {
                  const result = ts.visitEachChild(node, visitor, context);

                  if (fnDelaration) {
                    return fnDelaration;
                  }
                  return result;
                }

                if (ts.isObjectLiteralExpression(node)) {
                  return ts.visitEachChild(node, visitor, context);
                }

                if (ts.isPropertyAssignment(node)) {
                  contextChain.push(node.name.getText());

                  const result = ts.visitEachChild(node, visitor, context);

                  if (!fnDelaration) {
                    contextChain.pop();
                  }

                  return result;
                }

                if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
                  if (node.name?.getText() === name) {
                    functionArguments = node.parameters.map((param) => ({
                      key: param.name.getText(),
                      name: param.name.getText(),
                      type: param.type?.getText() || 'any',
                    }));

                    returnType = node.type?.getText() || 'any';

                    if (ts.isMethodDeclaration(node)) {
                      fnDelaration = factory.createFunctionDeclaration(
                        [],
                        node.asteriskToken,
                        node.name?.getText(),
                        node.typeParameters,
                        node.parameters,
                        node.type,
                        node.body,
                      );
                    } else {
                      fnDelaration = node;
                    }
                  }
                }

                return node;
              };

              return ts.visitEachChild(sourceFile, visitor, context);
            };
          },
        ],
      },
    });

    if (!functionArguments) {
      throw new Error(`Function ${name} not found.`);
    }
    if (!returnType) {
      throw new Error(`Return type not specified. Please add return type explicitly to function ${name}.`);
    }

    code = result.outputText;

    context = context || contextChain.join('.');

    let customFunction = await this.prisma.customFunction.findFirst({
      where: {
        user: {
          id: user.id,
        },
        name,
        context,
      },
    });

    if (customFunction) {
      this.logger.debug(`Updating custom function ${name} with context ${context} and code:\n${code}`);
      customFunction = await this.prisma.customFunction.update({
        where: {
          id: customFunction.id,
        },
        data: {
          code,
          arguments: JSON.stringify(functionArguments),
          returnType,
        },
      });
    } else {
      this.logger.debug(`Creating custom function ${name} with context ${context} and code:\n${code}`);
      customFunction = await this.prisma.customFunction.create({
        data: {
          user: {
            connect: {
              id: user.id,
            },
          },
          context,
          name,
          code,
          arguments: JSON.stringify(functionArguments),
          returnType,
        },
      });
    }

    if (serverFunction) {
      this.logger.debug(`Creating server side custom function ${name}`);

      try {
        await this.faasService.createFunction(customFunction.publicId, name, code, user.apiKey);
        return this.prisma.customFunction.update({
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
  }

  async findCustomFunctionByPublicId(publicId: string): Promise<CustomFunction | null> {
    return this.prisma.customFunction.findFirst({
      where: {
        publicId,
      },
    });
  }

  async executeServerFunction(customFunction: CustomFunction, args: Record<string, any>, clientID: string) {
    this.logger.debug(`Executing server function ${customFunction.publicId} with arguments ${JSON.stringify(args)}`);

    const functionArguments = JSON.parse(customFunction.arguments || '[]');
    const argumentsList = functionArguments.map((arg: FunctionArgument) => args[arg.key]);

    try {
      const result = await this.faasService.executeFunction(customFunction.publicId, argumentsList);
      this.logger.debug(
        `Server function ${customFunction.publicId} executed successfully with result: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Error executing server function ${customFunction.publicId}: ${error.message}`);
      const functionPath = `${customFunction.context ? `${customFunction.context}.` : ''}${customFunction.name}`;
      if (this.eventService.sendErrorEvent(clientID, functionPath, this.eventService.getEventError(error))) {
        return;
      }

      throw new InternalServerErrorException((error.response?.data as any)?.message || error.message);
    }
  }

  async setSystemPrompt(userId: number, prompt: string): Promise<SystemPrompt> {
    // clear the conversation so the user can test the new system prompt!
    this.aiService.clearConversation(userId.toString());

    const systemPrompt = await this.prisma.systemPrompt.findFirst({ orderBy: { createdAt: 'desc' } });
    if (systemPrompt) {
      this.logger.debug(`Found existing SystemPrompt ${systemPrompt.id}. Updating...`);
      return this.prisma.systemPrompt.update({
        where: {
          id: systemPrompt.id,
        },
        data: {
          content: prompt,
        },
      });
    }

    this.logger.debug(`Creating new SystemPrompt...`);
    return this.prisma.systemPrompt.create({
      data: {
        userId: userId,
        content: prompt,
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
        ...(await this.toPropertyType('ReturnType', type)),
        schema: typeSchema,
      };
    };

    return {
      id: apiFunction.publicId,
      type: 'apiFunction',
      context: apiFunction.context,
      name: apiFunction.name,
      description: apiFunction.description,
      function: {
        arguments: [
          ...(await Promise.all(requiredArguments.map(toPropertySpecification))),
          ...(payloadArguments.length > 0
            ? [
                {
                  name: 'payload',
                  required: true,
                  type: {
                    kind: 'object',
                    properties: await Promise.all(payloadArguments.map(toPropertySpecification)),
                  },
                },
              ]
            : []),
          ...(await Promise.all(optionalArguments.map(toPropertySpecification))),
        ] as PropertySpecification[],
        returnType: await getReturnType(),
      },
    };
  }

  async toCustomFunctionSpecification(
    customFunction: CustomFunction,
  ): Promise<CustomFunctionSpecification | ServerFunctionSpecification> {
    const parsedArguments = JSON.parse(customFunction.arguments || '[]');

    const toArgumentSpecification = async (arg: FunctionArgument): Promise<PropertySpecification> => ({
      name: arg.name,
      required: true,
      type: {
        kind: 'plain',
        value: arg.type,
      },
    });

    return {
      id: customFunction.publicId,
      type: customFunction.serverSide ? 'serverFunction' : 'customFunction',
      context: customFunction.context,
      name: customFunction.name,
      description: customFunction.description,
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

  async toPropertyType(name: string, type: ArgumentType, typeObject?: object): Promise<PropertyType> {
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
  ) {
    const functionArgs = this.getFunctionArguments(apiFunction);
    const metadata: ArgumentsMetadata = JSON.parse(apiFunction.argumentsMetadata || '{}');

    const resolveArgumentParameterLimit = () => {
      if (apiFunction.argumentsMetadata || functionArgs.length <= this.config.functionArgsParameterLimit) {
        return;
      }
      this.logger.debug(
        `Generating arguments metadata for ${
          apiFunction.id ? `function ${apiFunction.id}` : 'a new function'
        } with payload 'true' (arguments count: ${functionArgs.length})`,
      );
      functionArgs.forEach((arg) => {
        if (metadata[arg.key]) {
          metadata[arg.key].payload = true;
        } else {
          metadata[arg.key] = {
            payload: true,
          };
        }
      });
    };
    const resolveArgumentTypes = async () => {
      if (apiFunction.id) {
        this.logger.debug(`Resolving argument types for function ${apiFunction.id}...`);
      } else {
        this.logger.debug(`Resolving argument types for new function...`);
      }

      for (const arg of functionArgs) {
        if (metadata[arg.key]?.type) {
          continue;
        }
        const value = variables[arg.key];

        if (value == null) {
          continue;
        }

        const [type, typeSchema] = await this.resolveArgumentType(value);

        if (metadata[arg.key]) {
          metadata[arg.key].type = type;
          metadata[arg.key].typeSchema = typeSchema;
        } else {
          metadata[arg.key] = {
            type,
            typeSchema,
          };
        }
      }
    };

    resolveArgumentParameterLimit();
    await resolveArgumentTypes();

    return JSON.stringify(metadata);
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

  async updateAllServerFunctions(user: User) {
    this.logger.debug(`Updating all server functions. Invoked by user ${user.id}...`);
    const serverFunctions = await this.prisma.customFunction.findMany({
      where: {
        serverSide: true,
      },
    });

    for (const serverFunction of serverFunctions) {
      this.logger.debug(`Updating server function ${serverFunction.id}...`);
      await this.faasService.updateFunction(serverFunction.publicId, user.apiKey);
    }
  }
}
