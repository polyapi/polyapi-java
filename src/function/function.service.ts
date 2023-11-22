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
  OnModuleInit,
} from '@nestjs/common';
import { toCamelCase } from '@guanghechen/helper-string';
import { HttpService } from '@nestjs/axios';
import { catchError, from, lastValueFrom, map } from 'rxjs';
import mustache from 'mustache';
import { ApiFunction, CustomFunction, Environment, Tenant } from '@prisma/client';
import { PrismaService } from 'prisma-module/prisma.service';
import {
  ApiFunctionDetailsDto,
  ApiFunctionPublicDetailsDto,
  ApiFunctionResponseDto,
  ApiFunctionSpecification,
  ArgumentsMetadata,
  Auth,
  Body,
  ConfigVariableName,
  CustomFunctionSpecification,
  FunctionArgument,
  FunctionBasicDto,
  FunctionDetailsDto,
  FunctionPublicBasicDto,
  FunctionPublicDetailsDto,
  GraphQLBody,
  Header,
  Method,
  PostmanVariableEntry,
  PropertySpecification,
  PropertyType,
  PublicVisibilityValue,
  Role,
  ServerFunctionSpecification,
  TrainingDataGeneration,
  Variables,
  Visibility,
  VisibilityQuery,
  UpdateSourceFunctionDto,
  UpdateSourceNullableEntry,
  FormDataEntry,
  RawBody,
  FunctionLog,
} from '@poly/model';
import { EventService } from 'event/event.service';
import { AxiosError } from 'axios';
import { CommonService } from 'common/common.service';
import { PathError } from 'common/path-error';
import { ConfigService } from 'config/config.service';
import { AiService } from 'ai/ai.service';
import { compareArgumentsByRequired } from 'function/comparators';
import { FaasService, FaasLogsService } from 'function/faas/faas.service';
import { KNativeFaasService } from 'function/faas/knative/knative-faas.service';
import { transpileCode } from 'function/custom/transpiler';
import { SpecsService } from 'specs/specs.service';
import { ApiFunctionArguments } from './types';
import { isPlainObject, mergeWith, omit, uniqBy } from 'lodash';
import { ConfigVariableService } from 'config-variable/config-variable.service';
import { VariableService } from 'variable/variable.service';
import { IntrospectionQuery, VariableDefinitionNode } from 'graphql';
import {
  getGraphqlIdentifier,
  getGraphqlVariables,
  getJsonSchemaFromIntrospectionQuery,
  resolveGraphqlArgumentType,
} from './graphql/utils';
import { AuthService } from 'auth/auth.service';
import { AuthData, WithEnvironment, WithTenant } from 'common/types';
import { LimitService } from 'limit/limit.service';
import { isTemplateArg, JsonTemplate, JsonTemplateProcessor, POLY_ARG_NAME_KEY } from './custom/json-template';
import { ARGUMENT_PATTERN } from './custom/constants';
import { LokiLogsService } from './faas/loki-logs/loki-logs.service';

mustache.escape = (text) => {
  if (typeof text === 'string') {
    return text.replace(/"/g, '\\"');
  } else {
    return text;
  }
};

@Injectable()
export class FunctionService implements OnModuleInit {
  private readonly logger: Logger = new Logger(FunctionService.name);
  private readonly faasService: FaasService;
  private readonly faasLogsService: FaasLogsService;
  private readonly jsonTemplate: JsonTemplateProcessor;

  constructor(
    private readonly commonService: CommonService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly eventService: EventService,
    private readonly aiService: AiService,
    @Inject(forwardRef(() => SpecsService))
    private readonly specsService: SpecsService,
    private readonly configVariableService: ConfigVariableService,
    private readonly variableService: VariableService,
    private readonly authService: AuthService,
    private readonly limitService: LimitService,
  ) {
    this.faasService = new KNativeFaasService(config, httpService);
    this.faasLogsService = new LokiLogsService(config, httpService);
    this.jsonTemplate = new JsonTemplate();
  }

  async onModuleInit() {
    await this.faasService.init();
  }

  async getApiFunctions(environmentId: string, contexts?: string[], names?: string[], ids?: string[], visibilityQuery?: VisibilityQuery, includeTenant = false) {
    return this.prisma.apiFunction.findMany({
      where: {
        AND: [
          {
            OR: [
              { environmentId },
              visibilityQuery
                ? this.commonService.getVisibilityFilterCondition(visibilityQuery)
                : {},
            ],
          },
          {
            OR: this.commonService.getContextsNamesIdsFilterConditions(contexts, names, ids),
          },
        ],
      },
      include: includeTenant
        ? {
            environment: {
              include: {
                tenant: true,
              },
            },
          }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findApiFunction(id: string, includeEnvironment = false) {
    return this.prisma.apiFunction.findFirst({
      where: {
        id,
      },
      include: {
        environment: includeEnvironment,
      },
    });
  }

  async getPublicApiFunctions(tenant: Tenant, environment: Environment, includeHidden = false) {
    const apiFunctions = await this.prisma.apiFunction.findMany({
      where: {
        visibility: Visibility.Public,
        environment: {
          tenant: {
            NOT: {
              id: tenant.id,
            },
            publicVisibilityAllowed: true,
          },
        },
      },
      include: {
        environment: {
          include: {
            tenant: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return (
      await Promise.all(
        apiFunctions
          .map(apiFunction => this.resolveVisibility(tenant, environment, apiFunction)),
      )
    ).filter(apiFunction => includeHidden || !apiFunction.hidden);
  }

  async findPublicApiFunction(tenant: Tenant, environment: Environment, id: string) {
    const apiFunction = await this.prisma.apiFunction.findFirst({
      where: {
        id,
        visibility: Visibility.Public,
        environment: {
          tenant: {
            publicVisibilityAllowed: true,
          },
        },
      },
      include: {
        environment: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!apiFunction) {
      return null;
    }

    return await this.resolveVisibility(tenant, environment, apiFunction);
  }

  apiFunctionToBasicDto(apiFunction: ApiFunction): FunctionBasicDto {
    const visibility = apiFunction.visibility as Visibility;
    return {
      id: apiFunction.id,
      name: apiFunction.name,
      context: apiFunction.context,
      description: apiFunction.description,
      visibility,
    };
  }

  apiFunctionToTrainingDto(apiFunction: ApiFunction & { traceId?: string }) {
    return {
      ...this.apiFunctionToBasicDto(apiFunction),
      traceId: apiFunction.traceId,
    };
  }

  apiFunctionToDetailsDto(apiFunction: ApiFunction): ApiFunctionDetailsDto {
    const argumentsList = this.getFunctionArguments(apiFunction)
      .map<Omit<FunctionArgument<Record<string, any>>, 'location'>>(arg => ({
        ...omit(arg, 'location'),
        typeSchema: arg.typeSchema && JSON.parse(arg.typeSchema),
        removeIfNotPresentOnExecute: arg.removeIfNotPresentOnExecute || false,
      }));

    const parsedBody = JSON.parse(apiFunction.body || '{}');

    const headers: Header[] = JSON.parse(apiFunction.headers || '[]') as Header[];

    const parsedAuth = JSON.parse(apiFunction.auth || '{}');

    const [returnType, returnTypeSchema] = this.getReturnTypeData(apiFunction.responseType);

    return {
      ...this.apiFunctionToBasicDto(apiFunction),
      arguments: argumentsList,
      source: {
        url: apiFunction.url,
        method: apiFunction.method,
        headers,
        body: this.getBodySource(parsedBody),
        auth: parsedAuth,
      },
      enabledRedirect: apiFunction.enableRedirect,
      returnType,
      returnTypeSchema,
    };
  }

  apiFunctionToPublicBasicDto(apiFunction: WithTenant<ApiFunction> & { hidden: boolean }): FunctionPublicBasicDto {
    return {
      ...this.apiFunctionToBasicDto(apiFunction),
      context: this.commonService.getPublicContext(apiFunction),
      tenant: apiFunction.environment.tenant.name || '',
      hidden: apiFunction.hidden,
    };
  }

  apiFunctionToPublicDetailsDto(apiFunction: WithTenant<ApiFunction> & { hidden: boolean }): ApiFunctionPublicDetailsDto {
    return {
      ...this.apiFunctionToDetailsDto(apiFunction),
      context: this.commonService.getPublicContext(apiFunction),
      tenant: apiFunction.environment.tenant.name || '',
      hidden: apiFunction.hidden,
    };
  }

  async createOrUpdateApiFunction(
    id: string | null,
    environment: Environment,
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
    introspectionResponse: IntrospectionQuery | null,
    enableRedirect: boolean,
    templateAuth?: Auth,
    checkBeforeCreate: () => Promise<void> = async () => undefined,
  ): Promise<ApiFunction & { traceId?: string }> {
    if (!(statusCode >= HttpStatus.OK && statusCode < HttpStatus.BAD_REQUEST)) {
      throw new BadRequestException(
        `Api response status code should be between ${HttpStatus.OK} and ${HttpStatus.AMBIGUOUS}.`,
      );
    }

    const isGraphQL = this.isGraphQLBody(templateBody);

    if (isGraphQL && (response.errors || []).length) {
      throw new BadRequestException('Cannot teach a graphql call that contains errors.');
    }

    let apiFunction: ApiFunction | null = null;

    const finalAuth = templateAuth ? JSON.stringify(templateAuth) : null;
    const finalBody = JSON.stringify(this.getBodyWithContentFiltered(templateBody));
    const finalHeaders = JSON.stringify(this.getFilteredHeaders(templateHeaders));
    const graphqlIdentifier = isGraphQL ? getGraphqlIdentifier(templateBody.graphql.query) : '';

    const graphqlIntrospectionResponse = introspectionResponse ? JSON.stringify(introspectionResponse) : null;

    if (id === null) {
      const templateBaseUrl = templateUrl.split('?')[0];

      if (isGraphQL) {
        const apiFunctions = await this.prisma.apiFunction.findMany({
          where: {
            environmentId: environment.id,
            method,
            graphqlIdentifier,
            url: templateBaseUrl,
          },
        });

        if (apiFunctions.length > 1) {
          throw new BadRequestException('There exist more than 1 api function with same graphql alias:query combination, use { id: string } on polyData Postman environment variable to specify which one do you want to retrain.');
        }

        apiFunction = apiFunctions[0] || null;
      }

      if (!isGraphQL) {
        const apiFunctions = await this.prisma.apiFunction.findMany({
          where: {
            environmentId: environment.id,
            OR: [
              {
                url: {
                  startsWith: `${templateBaseUrl}?`,
                },
              },
              {
                url: templateBaseUrl,
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

      if ((!apiFunction.graphqlIdentifier && isGraphQL) || (!isGraphQL && !!apiFunction.graphqlIdentifier)) {
        throw new BadRequestException('Cannot mix training between graphql and api rest functions.');
      }

      this.logger.debug(`Explicitly retraining function with id ${id}.`);
    }

    const updating = (id === null || id !== 'new') && apiFunction !== null;
    if (!updating) {
      await checkBeforeCreate();
    }

    const argumentsMetadata = await this.resolveArgumentsMetadata(
      {
        argumentsMetadata: null,
        auth: finalAuth,
        body: finalBody,
        headers: finalHeaders,
        url: templateUrl,
        id: apiFunction?.id,
        graphqlIntrospectionResponse,
      },
      variables,
      true,
    );

    if (id === 'new') {
      this.logger.debug('Explicitly avoid retrain.');
      this.logger.debug('Creating a new poly function...');
    }

    if (id === null && updating && apiFunction) {
      this.logger.debug(`Found existing function ${apiFunction.id} for retraining. Updating...`);
    }

    if (id === null && !apiFunction) {
      this.logger.debug('Creating new poly function...');
    }

    let traceId: string | undefined;

    if ((!name || !context || !description) && !updating) {
      if (await this.isApiFunctionAITrainingEnabled(environment)) {
        try {
          const {
            name: aiName,
            description: aiDescription,
            arguments: aiArguments,
            context: aiContext,
            trace_id: aiTraceId,
          } = await this.aiService.getFunctionDescription(
            environment.tenantId,
            url,
            apiFunction?.method || method,
            description || apiFunction?.description || '',
            await this.toArgumentSpecifications(argumentsMetadata),
            JSON.stringify(this.commonService.trimDownObject(this.getBodyData(body))),
            JSON.stringify(this.commonService.trimDownObject(response)),
          );

          if (aiTraceId) {
            traceId = aiTraceId;
          }

          if (!name) {
            name = aiName
              ? this.commonService.sanitizeNameIdentifier(aiName)
              : this.commonService.sanitizeNameIdentifier(requestName);
          }
          if (!context && !apiFunction?.context) {
            context = this.commonService.sanitizeContextIdentifier(aiContext);
          }
          if (!description && !apiFunction?.description) {
            description = aiDescription;
          }

          this.logger.debug(`Setting argument descriptions to arguments metadata from AI: ${JSON.stringify(aiArguments)}...`);

          (aiArguments || [])
            .filter((aiArgument) => !argumentsMetadata[aiArgument.name].description)
            .forEach((aiArgument) => {
              argumentsMetadata[aiArgument.name].description = aiArgument.description;
            });
        } catch (err) {
          this.logger.error('Failed to generate AI data for new api function. Taking function name from request name if not provided...');

          if (!name) {
            name = this.commonService.sanitizeNameIdentifier(requestName);
          }
        }
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

    const finalContext = context?.trim() || '';
    const finalName = name?.trim() ? name : this.commonService.sanitizeNameIdentifier(requestName);
    const finalDescription = description || '';

    if (!finalName) {
      throw new BadRequestException('Couldn\'t infer function name neither from user, ai service or postman request name.');
    }

    let responseType: string;
    try {
      responseType = await this.getResponseType(response, payload);
    } catch (e) {
      if (e instanceof PathError) {
        throw new BadRequestException(e.message);
      } else {
        throw e;
      }
    }

    const currentArgumentsMetadata = JSON.parse(apiFunction?.argumentsMetadata || '{}') as ArgumentsMetadata;

    for (const [key, value] of Object.entries(currentArgumentsMetadata)) {
      if (typeof argumentsMetadata[key] !== 'undefined' && value.description) {
        argumentsMetadata[key].description = value.description;
      }
    }

    const upsertPayload = {
      context: finalContext,
      description: finalDescription,
      payload,
      responseType,
      body: finalBody,
      headers: finalHeaders,
      auth: finalAuth,
      url: templateUrl,
      argumentsMetadata: JSON.stringify(argumentsMetadata),
      graphqlIdentifier,
      graphqlIntrospectionResponse,
      enableRedirect,
    };

    if (apiFunction && updating) {
      return this.prisma.apiFunction.update({
        where: {
          id: apiFunction.id,
        },
        data: {
          ...upsertPayload,
          name: await this.resolveFunctionName(environment.id, finalName, finalContext, true, true, [apiFunction.id]),
        },
      });
    }

    return {
      ...(await this.prisma.apiFunction.create({
        data: {
          environment: {
            connect: {
              id: environment.id,
            },
          },
          ...upsertPayload,
          name: await this.resolveFunctionName(environment.id, finalName, finalContext, true, true),
          method,
        },
      })),
      traceId,
    };
  }

  async updateApiFunction(
    apiFunction: ApiFunction,
    name: string | null,
    context: string | null,
    description: string | null,
    argumentsMetadata: ArgumentsMetadata | null,
    response: any | undefined,
    payload: string | undefined,
    visibility: Visibility | null,
    source: UpdateSourceFunctionDto | undefined,
    enableRedirect: boolean | undefined,
    returnType: string | undefined,
    returnTypeSchema: Record<string, any> | undefined,
    templateBody: string | undefined,
  ) {
    if (name != null || context != null) {
      name = name ? await this.resolveFunctionName(apiFunction.environmentId, name, apiFunction.context, true) : null;

      if (
        !(await this.checkContextAndNameDuplicates(apiFunction.environmentId, context == null
          ? apiFunction.context || ''
          : context, name || apiFunction.name, [apiFunction.id]))
      ) {
        throw new ConflictException(`Function with name ${name} and context ${context} already exists.`);
      }
    }

    this.logger.debug(
      `Updating URL function ${apiFunction.id} with name ${name}, context ${context}, description ${description}`,
    );

    const finalContext = (context == null ? apiFunction.context : context).trim();
    const finalName = name || apiFunction.name;

    let responseType: string | undefined;
    if (response !== undefined) {
      responseType = await this.getResponseType(response, payload ?? apiFunction.payload);
    } else if (returnTypeSchema !== undefined) {
      responseType = JSON.stringify(returnTypeSchema);
    } else if (returnType !== undefined) {
      responseType = returnType.trim();
    }

    const newSourceData = this.processNewSourceData(apiFunction, source, templateBody);

    const patchSourceData = {
      ...(newSourceData?.body ? { body: newSourceData.body } : null),
      ...(newSourceData?.headers ? { headers: newSourceData.headers } : null),
      ...(newSourceData?.url ? { url: newSourceData.url } : null),
      ...(newSourceData?.method ? { method: newSourceData.method } : null),
      ...(newSourceData?.auth ? { auth: newSourceData.auth } : null),
    };

    const patchedApiFunction = {
      ...apiFunction,
      ...patchSourceData,
    };

    if (argumentsMetadata != null) {
      await this.checkArgumentsMetadata(patchedApiFunction, argumentsMetadata);

      argumentsMetadata = await this.resolveArgumentsTypeSchema(patchedApiFunction, argumentsMetadata);
    }

    argumentsMetadata = this.mergeArgumentsMetadata(apiFunction.argumentsMetadata, argumentsMetadata);

    const duplicatedArgumentName = this.findDuplicatedArgumentName(
      this.getFunctionArguments({
        ...patchedApiFunction,
        argumentsMetadata: JSON.stringify(argumentsMetadata),
      }),
    );

    if (duplicatedArgumentName) {
      throw new ConflictException(`Function has duplicated arguments: ${duplicatedArgumentName}`);
    }

    if (patchSourceData.body || patchSourceData.url || patchSourceData.headers || patchSourceData.auth) {
      const functionArguments = this.getFunctionArguments(patchedApiFunction);

      // Delete unused arguments metadata if user has patched source data (could've remove some parts of body).
      for (const [argumentName] of Object.entries((argumentsMetadata as ArgumentsMetadata))) {
        if (!functionArguments.find(functionArgument => functionArgument.key === argumentName)) {
          delete (argumentsMetadata as ArgumentsMetadata)[argumentName];
        }
      }

      // Add new arguments if user did not provide them through "arguments key".
      for (const funcArg of functionArguments) {
        if (typeof argumentsMetadata[funcArg.name] === 'undefined') {
          argumentsMetadata[funcArg.name] = {
            name: funcArg.name,
            type: funcArg.type,
          };
        }
      }
    }

    return this.prisma.apiFunction.update({
      where: {
        id: apiFunction.id,
      },
      data: {
        name: finalName,
        context: finalContext,
        description: description == null ? apiFunction.description : description,
        argumentsMetadata: JSON.stringify(argumentsMetadata),
        responseType,
        payload,
        visibility: visibility == null ? apiFunction.visibility : visibility,
        enableRedirect,
        ...patchSourceData,
      },
    });
  }

  private processNewSourceData(apiFunction: ApiFunction, source: UpdateSourceFunctionDto | undefined, templateBody: string | undefined): {
    headers?: string;
    url?: string;
    body?: string;
    method?: string;
    auth?: string;
  } | null {
    const jsonTemplateParser = new JsonTemplate();

    if (!source) {
      return null;
    }

    const sourceData: {
      headers?: string;
      url?: string;
      body?: string;
      method?: string;
      auth?: string;
    } = {
      headers: undefined,
      url: source.url,
      body: undefined,
      method: source.method,
      auth: undefined,
    };

    const entryRecordToList = (entryRecord: Record<string, string | null>): PostmanVariableEntry[] => {
      return Object.entries(entryRecord).reduce<UpdateSourceNullableEntry[]>((acum, [key, value]) => {
        return [...acum, { key, value }];
      }, []).filter((entry): entry is PostmanVariableEntry => entry.value !== null);
    };

    const mergeEntries = (currentEntries: PostmanVariableEntry[], entryRecord: Record<string, string | null>): typeof currentEntries => {
      let clonedEntries = [...currentEntries];

      for (const [key, value] of Object.entries(entryRecord)) {
        // Remove entry
        if (value === null) {
          clonedEntries = clonedEntries.filter(entry => entry.key !== key);
          continue;
        }

        const foundEntry = clonedEntries.find(entry => entry.key === key);

        // Override entry
        if (foundEntry) {
          clonedEntries = clonedEntries.map((entry) => {
            if (entry.key === key) {
              return {
                ...entry,
                value,
              };
            }

            return entry;
          });
          continue;
        }

        // Add new entry
        clonedEntries.push({
          key,
          value,
        });
      }

      return clonedEntries;
    };

    if (typeof source.headers !== 'undefined') {
      const currentHeaders = JSON.parse(apiFunction.headers || '[]') as Header[];

      sourceData.headers = JSON.stringify(mergeEntries(currentHeaders, source.headers));
    }

    if (typeof source.body !== 'undefined') {
      let currentBody = JSON.parse(apiFunction.body || '{}') as Body;

      if (source.body.mode === 'empty') {
        currentBody = {};
      } else if (source.body.mode === 'raw') {
        if (typeof templateBody === 'undefined') {
          throw new BadRequestException('Could not process this operation. Did you forgot to add your poly-training-assistant.js pre-request script ?.');
        }

        const templateObj = jsonTemplateParser.parse(templateBody);

        currentBody = {
          mode: 'raw',
          raw: jsonTemplateParser.toTemplateString(templateObj['source']['body']['raw']),
          options: {
            raw: {
              language: 'json',
            },
          },
        };
      } else {
        if (source.body.mode === 'urlencoded') {
          if (currentBody.mode !== 'urlencoded') {
            currentBody = {
              mode: source.body.mode,
              urlencoded: entryRecordToList(source.body.urlencoded),
            };
          } else {
            currentBody = {
              mode: source.body.mode,
              urlencoded: mergeEntries(currentBody.urlencoded, source.body.urlencoded),
            };
          }
        }

        if (source.body.mode === 'formdata') {
          if (currentBody.mode !== 'formdata') {
            currentBody = {
              mode: source.body.mode,
              formdata: entryRecordToList(source.body.formdata).map<FormDataEntry>(entry => ({ ...entry, type: 'string' })),
            };
          } else {
            currentBody = {
              mode: source.body.mode,
              formdata: mergeEntries(currentBody.formdata, source.body.formdata)
                .map<FormDataEntry>(entry => ({ ...entry, type: 'string' })),
            };
          }
        }
      }

      sourceData.body = JSON.stringify(currentBody);
    }

    if (typeof source.auth !== 'undefined') {
      if (source.auth.type === 'bearer') {
        sourceData.auth = JSON.stringify({
          type: 'bearer',
          bearer: [{ key: 'token', type: 'any', value: source.auth.bearer }],
        });
      } else if (source.auth.type === 'noauth') {
        sourceData.auth = JSON.stringify({
          type: source.auth.type,
          noauth: [],
        });
      } else {
        sourceData.auth = JSON.stringify(source.auth);
      }
    }

    return sourceData;
  }

  private processRawBody(body: RawBody, argumentsMetadata: ArgumentsMetadata, args: Record<string, any>) {
    this.logger.debug(`Processing raw body: ${JSON.stringify(body)}`);

    const jsonTemplateObject = this.jsonTemplate.parse(body.raw);

    this.logger.debug(`Json template is ${JSON.stringify(jsonTemplateObject)}`);

    const removeUndefinedValuesFromOptionalArgs = (value: any) => {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          value[i] = removeUndefinedValuesFromOptionalArgs(value[i]);
        }
      }

      if (!(isPlainObject as (value: unknown) => value is Record<string, any>)(value)) {
        return value;
      }

      if (isPlainObject(value)) {
        if (
          isTemplateArg(value)
        ) {
          const argName = value[POLY_ARG_NAME_KEY];
          const argValue = args[argName];
          const argMetadata = argumentsMetadata[argName] as ArgumentsMetadata[string];

          if (typeof argMetadata === 'undefined' || (argMetadata.required === false && argMetadata.removeIfNotPresentOnExecute === true && typeof argValue === 'undefined')) {
            return undefined;
          }

          return value;
        }

        for (const key of Object.keys(value)) {
          value[key] = removeUndefinedValuesFromOptionalArgs(value[key]);
          if (typeof value[key] === 'undefined') {
            delete value[key];
          }
        }
      }

      return value;
    };

    // Filter un-used optional args.
    const filteredJsonTemplate = removeUndefinedValuesFromOptionalArgs(jsonTemplateObject);

    const rawObj = this.jsonTemplate.render(filteredJsonTemplate, args);

    return {
      mode: 'raw',
      raw: JSON.stringify(rawObj),
    } as RawBody;
  }

  async executeApiFunction(
    apiFunction: ApiFunction & { environment: Environment },
    args: Record<string, any>,
    userId: string | null = null,
    applicationId: string | null = null,
  ): Promise<ApiFunctionResponseDto | null> {
    this.logger.debug(`Executing function ${apiFunction.id}...`);

    const argumentsMetadata = JSON.parse(apiFunction.argumentsMetadata || '{}') as ArgumentsMetadata;
    let argumentValueMap: {[key: string]: any } = {};
    const method = apiFunction.method;
    const parsedBody = JSON.parse(apiFunction.body || '{}') as Body;

    let body: Body | null = null;

    if (parsedBody.mode === 'urlencoded' || parsedBody.mode === 'formdata') {
      argumentValueMap = await this.getArgumentValueMap(apiFunction, args);
      const filterOptionalArgs = (entry: PostmanVariableEntry) => {
        if (!entry.value.match(ARGUMENT_PATTERN)) {
          return true;
        }

        const argName = entry.value.replace('{{', '').replace('}}', '');

        if (argumentsMetadata[argName].required === false &&
          argumentsMetadata[argName].removeIfNotPresentOnExecute === true &&
          typeof argumentValueMap[argName] === 'undefined') {
          return false;
        }

        return true;
      };

      const filteredBody = parsedBody.mode === 'formdata'
        ? {
            mode: parsedBody.mode,
            formdata: parsedBody.formdata.filter(filterOptionalArgs),
          }
        : {
            mode: parsedBody.mode,
            urlencoded: parsedBody.urlencoded.filter(filterOptionalArgs),
          };

      body = JSON.parse(mustache.render(JSON.stringify(filteredBody), argumentValueMap)) as Body;
    } else if (parsedBody.mode === 'raw' && parsedBody.raw) {
      argumentValueMap = await this.getArgumentValueMap(apiFunction, args, false);
      body = this.processRawBody(parsedBody, argumentsMetadata, argumentValueMap);
    } else {
      argumentValueMap = await this.getArgumentValueMap(apiFunction, args);
      body = JSON.parse(mustache.render(apiFunction.body || '', argumentValueMap)) as Body;
    }

    const url = mustache.render(apiFunction.url, argumentValueMap);
    const auth = apiFunction.auth ? JSON.parse(mustache.render(apiFunction.auth, argumentValueMap)) : null;

    const params = {
      ...this.getAuthorizationQueryParams(auth),
    };

    const headers = {
      ...JSON.parse(mustache.render(apiFunction.headers || '[]', argumentValueMap))
        .filter((header) => !!header.key?.trim())
        .reduce(
          (headers, header) => Object.assign(headers, { [header.key]: header.value }),
          {},
        ),
      ...this.getContentTypeHeaders(body),
      ...this.getAuthorizationHeaders(auth),
    };

    const isGraphql = this.isGraphQLBody(body);

    this.logger.debug(
      `Performing HTTP request ${method} ${url} (id: ${apiFunction.id})...\nHeaders:\n${JSON.stringify(
        headers,
      )}\nBody:\n${JSON.stringify(body)}`,
    );

    const executionData = this.getBodyData(body);

    if (isGraphql) {
      executionData.variables = args;
    }

    return lastValueFrom(
      this.httpService
        .request({
          url,
          method,
          headers,
          params,
          data: executionData,
          ...(!apiFunction.enableRedirect ? { maxRedirects: 0 } : null),
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

            const finalResponse = {
              status: response.status,
              headers: response.headers,
            };

            return {
              ...finalResponse,
              data: processData(),
            } as ApiFunctionResponseDto;
          }),
        )
        .pipe(
          catchError((error: AxiosError) => {
            const processError = async () => {
              this.logger.error(`Error while performing HTTP request (id: ${apiFunction.id}): ${error}`);

              const functionPath = `${apiFunction.context ? `${apiFunction.context}.` : ''}${apiFunction.name}`;
              const errorEventSent = await this.eventService.sendErrorEvent(
                apiFunction.id,
                apiFunction.environmentId,
                apiFunction.environment.tenantId,
                apiFunction.visibility as Visibility,
                applicationId,
                userId,
                functionPath,
                this.eventService.getEventError(error),
              );

              if (error.response) {
                return {
                  status: error.response.status,
                  headers: error.response.headers,
                  data: error.response.data,
                } as ApiFunctionResponseDto;
              } else if (!errorEventSent) {
                throw new InternalServerErrorException(error.message);
              } else {
                return null;
              }
            };

            return from(processError());
          }),
        ),
    );
  }

  async deleteApiFunction(id: string) {
    this.logger.debug(`Deleting API function ${id}`);
    await this.prisma.apiFunction.delete({
      where: {
        id,
      },
    });
  }

  async toApiFunctionSpecification(apiFunction: ApiFunction): Promise<ApiFunctionSpecification> {
    const functionArguments = this.getFunctionArguments(apiFunction)
      .filter(arg => !arg.variable);
    const requiredArguments = functionArguments.filter((arg) => !arg.payload && arg.required);
    const optionalArguments = functionArguments.filter((arg) => !arg.payload && !arg.required);
    const payloadArguments = functionArguments.filter((arg) => arg.payload);

    const getReturnType = async (): Promise<PropertyType> => {
      if (!apiFunction.responseType) {
        return {
          kind: 'void',
        };
      }
      try {
        const schema = JSON.parse(apiFunction.responseType);
        return {
          kind: 'object',
          schema,
        };
      } catch {
        return await this.commonService.toPropertyType('ReturnType', apiFunction.responseType);
      }
    };

    return {
      id: apiFunction.id,
      type: 'apiFunction',
      context: apiFunction.context,
      name: toCamelCase(apiFunction.name),
      description: apiFunction.description,
      function: {
        arguments: [
          ...(await Promise.all(requiredArguments.map(arg => this.toArgumentSpecification(arg)))),
          ...(
            payloadArguments.length > 0
              ? [
                  {
                    name: 'payload',
                    required: true,
                    type: {
                      kind: 'object',
                      properties: await Promise.all(payloadArguments.map(arg => this.toArgumentSpecification(arg))),
                    },
                  },
                ]
              : []
          ),
          ...(await Promise.all(optionalArguments.map(arg => this.toArgumentSpecification(arg)))),
        ] as PropertySpecification[],
        returnType: await getReturnType(),
      },
      visibilityMetadata: {
        visibility: apiFunction.visibility as Visibility,
      },
      apiType: apiFunction.graphqlIdentifier ? 'graphql' : 'rest',
    };
  }

  async getCustomFunctions(environmentId: string, contexts?: string[], names?: string[], ids?: string[], visibilityQuery?: VisibilityQuery, includeTenant = false) {
    return this.prisma.customFunction.findMany({
      where: {
        AND: [
          {
            OR: [
              { environmentId },
              visibilityQuery
                ? this.commonService.getVisibilityFilterCondition(visibilityQuery)
                : {},
            ],
          },
          {
            OR: this.commonService.getContextsNamesIdsFilterConditions(contexts, names, ids),
          },
          {
            name: {
              not: {
                equals: this.config.prebuiltBaseImageName,
              },
            },
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: includeTenant
        ? {
            environment: {
              include: {
                tenant: true,
              },
            },
          }
        : undefined,
    });
  }

  customFunctionToBasicDto(customFunction: CustomFunction): FunctionBasicDto {
    return {
      id: customFunction.id,
      name: customFunction.name,
      description: customFunction.description,
      context: customFunction.context,
      visibility: customFunction.visibility as Visibility,
      enabled: customFunction.enabled ? undefined : false,
      logsEnabled: customFunction.logsEnabled,
    };
  }

  customFunctionToDetailsDto(customFunction: CustomFunction): FunctionDetailsDto {
    const [returnType, returnTypeSchema] = this.getReturnTypeData(customFunction.returnType);

    return {
      ...this.customFunctionToBasicDto(customFunction),
      arguments: JSON.parse(customFunction.arguments).map((arg) => ({
        ...arg,
        required: arg.required == null ? true : arg.required,
        secure: arg.secure == null ? false : arg.secure,
      })),
      returnType,
      returnTypeSchema,
    };
  }

  customServerFunctionResponseDto(customFunction: CustomFunction & { traceId?: string }) {
    return {
      ...this.customFunctionToDetailsDto(customFunction),
      traceId: customFunction.traceId,
    };
  }

  customFunctionToPublicBasicDto(customFunction: WithTenant<CustomFunction> & {
    hidden: boolean
  }): FunctionPublicBasicDto {
    const tenant = customFunction.environment.tenant;
    return {
      ...this.customFunctionToBasicDto(customFunction),
      context: this.commonService.getPublicContext(customFunction),
      tenant: tenant.name || '',
      hidden: customFunction.hidden,
    };
  }

  customFunctionToPublicDetailsDto(customFunction: WithTenant<CustomFunction> & {
    hidden: boolean
  }): FunctionPublicDetailsDto {
    return {
      ...this.customFunctionToDetailsDto(customFunction),
      context: this.commonService.getPublicContext(customFunction),
      tenant: customFunction.environment.tenant.name || '',
      hidden: customFunction.hidden,
    };
  }

  async createOrUpdateClientFunction(
    environment: Environment,
    context: string,
    name: string,
    description: string,
    customCode: string,
    typeSchemas: Record<string, any>,
    checkBeforeCreate: () => Promise<void> = async () => undefined,
  ) {
    return this.createOrUpdateCustomFunction(
      environment,
      context,
      name,
      description,
      customCode,
      typeSchemas,
      false,
      null,
      false,
      checkBeforeCreate,
    );
  }

  async createOrUpdateServerFunction(
    environment: Environment,
    context: string,
    name: string,
    description: string,
    customCode: string,
    typeSchemas: Record<string, any>,
    apiKey: string,
    logsEnabled: boolean,
    checkBeforeCreate: () => Promise<void> = async () => undefined,
    createFromScratch = false,
  ) {
    return this.createOrUpdateCustomFunction(
      environment,
      context,
      name,
      description,
      customCode,
      typeSchemas,
      true,
      apiKey,
      logsEnabled,
      checkBeforeCreate,
      createFromScratch,
    );
  }

  async createOrUpdateCustomFunction(
    environment: Environment,
    context: string,
    name: string,
    description: string,
    customCode: string,
    typeSchemas: Record<string, any>,
    serverFunction: boolean,
    apiKey: string | null,
    logsEnabled = false,
    checkBeforeCreate: () => Promise<void> = async () => undefined,
    createFromScratch = false,
  ): Promise<CustomFunction & { traceId?: string }> {
    const {
      code,
      args,
      returnType,
      synchronous,
      contextChain,
      requirements,
    } = await transpileCode(name, customCode, typeSchemas);

    context = context || contextChain.join('.');

    let customFunction = await this.prisma.customFunction.findFirst({
      where: {
        environmentId: environment.id,
        name,
        context,
      },
    });

    let traceId: string | undefined;

    const argumentsNeedDescription = !customFunction || JSON.parse(customFunction.arguments).some((arg) => {
      const newArg = args.find((a) => a.key === arg.key);
      return !newArg || newArg.type !== arg.type || !arg.description;
    });

    if ((!description && !customFunction?.description) || argumentsNeedDescription) {
      if (await this.isCustomFunctionAITrainingEnabled(environment, serverFunction)) {
        const {
          description: aiDescription,
          arguments: aiArguments,
          traceId: aiTraceId,
        } = await this.getCustomFunctionAIData(environment.tenantId, description, args, code);
        const existingArguments = JSON.parse(customFunction?.arguments || '[]') as FunctionArgument[];

        if (aiTraceId) {
          traceId = aiTraceId;
        }

        description = description || customFunction?.description || aiDescription;
        aiArguments.forEach(aiArgument => {
          const existingArgument = existingArguments.find(arg => arg.key === aiArgument.name);
          const updatedArgument = args.find(arg => arg.key === aiArgument.name);
          if (updatedArgument && !existingArgument?.description) {
            updatedArgument.description = aiArgument.description;
          }
        });
      }
    }

    if (customFunction) {
      this.logger.debug(`Updating custom function ${name} with context ${context}, imported libraries: [${[...requirements].join(', ')}], code:\n${code}`);
      const serverSide = customFunction.serverSide;

      customFunction = await this.prisma.customFunction.update({
        where: {
          id: customFunction.id,
        },
        data: {
          code,
          description: description || customFunction.description,
          arguments: JSON.stringify(args),
          returnType,
          synchronous,
          requirements: JSON.stringify(requirements),
          serverSide: serverFunction,
          apiKey: serverFunction ? apiKey : null,
        },
      });

      if (serverSide && !serverFunction) {
        // server side function was changed to client side function
        await this.faasService.deleteFunction(customFunction.id, environment.tenantId, environment.id);
      }
    } else {
      await checkBeforeCreate();

      this.logger.debug(`Creating custom function ${name} with context ${context}, imported libraries: [${[...requirements].join(', ')}], code:\n${code}`);

      customFunction = await this.prisma.customFunction.create({
        data: {
          environment: {
            connect: {
              id: environment.id,
            },
          },
          context,
          name,
          description,
          code,
          arguments: JSON.stringify(args),
          returnType,
          synchronous,
          requirements: JSON.stringify(requirements),
          serverSide: serverFunction,
          apiKey: serverFunction ? apiKey : null,
          logsEnabled,
        },
      });
    }

    if (serverFunction && apiKey) {
      this.logger.debug(`Creating server side custom function ${name}`);

      const revertServerFunctionFlag = async () => {
        await this.prisma.customFunction.update({
          where: {
            id: customFunction?.id,
          },
          data: {
            serverSide: false,
            apiKey: null,
          },
        });
      };

      try {
        await this.faasService.createFunction(
          customFunction.id,
          environment.tenantId,
          environment.id,
          name,
          code,
          requirements,
          apiKey,
          await this.limitService.getTenantServerFunctionLimits(environment.tenantId),
          createFromScratch,
          customFunction.sleep,
          customFunction.sleepAfter,
          logsEnabled,
        );

        return customFunction;
      } catch (e) {
        this.logger.error(
          `Error creating server side custom function ${name}: ${e.message}. Function created as client side.`,
        );
        await revertServerFunctionFlag();
        throw e;
      }
    }

    return {
      ...customFunction,
      traceId,
    };
  }

  async updateClientFunction(
    customFunction: WithEnvironment<CustomFunction>,
    name: string | null,
    context: string | null,
    description: string | null,
    visibility: Visibility | null,
    argumentsMetadata?: ArgumentsMetadata,
  ) {
    return this.updateCustomFunction(
      customFunction,
      name,
      context,
      description,
      visibility,
      argumentsMetadata,
    );
  }

  async updateServerFunction(
    customFunction: WithEnvironment<CustomFunction>,
    name: string | null,
    context: string | null,
    description: string | null,
    visibility: Visibility | null,
    argumentsMetadata?: ArgumentsMetadata,
    enabled?: boolean,
    sleep?: boolean,
    sleepAfter?: number,
    logsEnabled?: boolean,
  ) {
    return this.updateCustomFunction(
      customFunction,
      name,
      context,
      description,
      visibility,
      argumentsMetadata,
      enabled,
      sleep,
      sleepAfter,
      logsEnabled,
    );
  }

  private async updateCustomFunction(
    customFunction: WithEnvironment<CustomFunction>,
    name: string | null,
    context: string | null,
    description: string | null,
    visibility: Visibility | null,
    argumentsMetadata?: ArgumentsMetadata,
    enabled?: boolean,
    sleep?: boolean,
    sleepAfter?: number,
    logsEnabled?: boolean,
  ) {
    const { id, name: currentName, context: currentContext } = customFunction;

    if (context != null || name != null) {
      if (!(await this.checkContextAndNameDuplicates(customFunction.environmentId, context || currentContext, name || currentName, [id]))) {
        throw new ConflictException(`Function with name ${name} and context ${context} already exists.`);
      }
    }
    if (argumentsMetadata) {
      argumentsMetadata = this.mergeCustomFunctionArgumentsMetadata(customFunction.arguments, argumentsMetadata);
    }

    this.logger.debug(
      `Updating custom function ${id} with name ${name}, context ${context}, description ${description}`,
    );

    if (customFunction.serverSide && (sleepAfter != null || sleep != null || logsEnabled != null)) {
      await this.faasService.updateFunction(
        customFunction.id,
        customFunction.environment.tenantId,
        customFunction.environment.id,
        customFunction.name,
        customFunction.code,
        JSON.parse(customFunction.requirements || '[]'),
        customFunction.apiKey!,
        await this.limitService.getTenantServerFunctionLimits(customFunction.environment.tenantId),
        sleep ?? customFunction.sleep,
        sleepAfter ?? customFunction.sleepAfter,
        logsEnabled,
      );
    }

    return this.prisma.customFunction.update({
      where: {
        id,
      },
      data: {
        name: name == null ? customFunction.name : toCamelCase(name),
        context: (context == null ? customFunction.context : context).trim(),
        description: description == null ? customFunction.description : description,
        visibility: visibility == null ? customFunction.visibility : visibility,
        enabled,
        arguments: argumentsMetadata ? JSON.stringify(argumentsMetadata) : undefined,
        sleep,
        sleepAfter,
        logsEnabled,
      },
    });
  }

  async deleteCustomFunction(id: string, environment: Environment) {
    this.logger.debug(`Deleting custom function ${id}`);
    const customFunction = await this.prisma.customFunction.delete({
      where: {
        id,
      },
    });

    if (customFunction.serverSide) {
      this.faasService.deleteFunction(id, environment.tenantId, environment.id).catch((err) => {
        this.logger.error(err, `Something failed when removing custom function ${id}.`);
      });
    }
  }

  async getClientFunctions(environmentId: string, contexts?: string[], names?: string[], ids?: string[]) {
    return this.prisma.customFunction.findMany({
      where: {
        AND: [
          {
            OR: [
              { environmentId },
              { visibility: Visibility.Public },
            ],
          },
          {
            OR: this.commonService.getContextsNamesIdsFilterConditions(contexts, names, ids),
          },
        ],
        serverSide: false,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findClientFunction(id: string) {
    return this.prisma.customFunction.findFirst({
      where: {
        id,
        serverSide: false,
      },
      include: {
        environment: true,
      },
    });
  }

  async getPublicClientFunctions(tenant: Tenant, environment: Environment, includeHidden = false) {
    const clientFunctions = await this.prisma.customFunction.findMany({
      where: {
        visibility: Visibility.Public,
        serverSide: false,
        environment: {
          tenant: {
            NOT: {
              id: tenant.id,
            },
            publicVisibilityAllowed: true,
          },
        },
      },
      include: {
        environment: {
          include: {
            tenant: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return (
      await Promise.all(
        clientFunctions.map(clientFunction => this.resolveVisibility(tenant, environment, clientFunction)),
      )
    ).filter(clientFunction => includeHidden || !clientFunction.hidden);
  }

  async findPublicClientFunction(tenant: Tenant, environment: Environment, id: string) {
    const clientFunction = await this.prisma.customFunction.findFirst({
      where: {
        id,
        serverSide: false,
        visibility: Visibility.Public,
        environment: {
          tenant: {
            publicVisibilityAllowed: true,
          },
        },
      },
      include: {
        environment: {
          include: {
            tenant: true,
          },
        },
      },
    });
    if (!clientFunction) {
      return null;
    }

    return this.resolveVisibility(tenant, environment, clientFunction);
  }

  async getServerFunctions(environmentId: string, contexts?: string[], names?: string[], ids?: string[]) {
    return this.prisma.customFunction.findMany({
      where: {
        AND: [
          {
            OR: [
              { environmentId },
              { visibility: Visibility.Public },
            ],
          },
          {
            OR: this.commonService.getContextsNamesIdsFilterConditions(contexts, names, ids),
          },
          {
            name: {
              not: {
                equals: this.config.prebuiltBaseImageName,
              },
            },
          },
        ],
        serverSide: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findServerFunction(id: string, includeEnvironment = false) {
    return this.prisma.customFunction.findFirst({
      where: {
        id,
        serverSide: true,
      },
      include: {
        environment: includeEnvironment,
      },
    });
  }

  async getPublicServerFunctions(tenant: Tenant, environment: Environment, includeHidden = false) {
    const serverFunctions = await this.prisma.customFunction.findMany({
      where: {
        visibility: Visibility.Public,
        serverSide: true,
        environment: {
          tenant: {
            NOT: {
              id: tenant.id,
            },
            publicVisibilityAllowed: true,
          },
        },
      },
      include: {
        environment: {
          include: {
            tenant: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return (
      await Promise.all(
        serverFunctions.map(clientFunction => this.resolveVisibility(tenant, environment, clientFunction)),
      )
    ).filter(clientFunction => includeHidden || !clientFunction.hidden);
  }

  async findPublicServerFunction(tenant: Tenant, environment: Environment, id: string) {
    const serverFunction = await this.prisma.customFunction.findFirst({
      where: {
        id,
        serverSide: true,
        visibility: Visibility.Public,
        environment: {
          tenant: {
            publicVisibilityAllowed: true,
          },
        },
      },
      include: {
        environment: {
          include: {
            tenant: true,
          },
        },
      },
    });
    if (!serverFunction) {
      return null;
    }

    return this.resolveVisibility(tenant, environment, serverFunction);
  }

  async executeServerFunction(
    customFunction: CustomFunction,
    executionEnvironment: Environment,
    args: Record<string, any> | any[],
    headers: Record<string, any> = {},
    userId: string | null = null,
    applicationId: string | null = null,
  ) {
    this.logger.debug(`Executing server function ${customFunction.id}...`);

    const functionArguments = JSON.parse(customFunction.arguments || '[]');

    const argumentsList = Array.isArray(args) ? args : functionArguments.map((arg: FunctionArgument) => typeof args[arg.key] === 'undefined' ? '$poly-undefined-value' : args[arg.key]);

    try {
      const result = await this.faasService.executeFunction(customFunction.id, executionEnvironment.tenantId, executionEnvironment.id, argumentsList, headers);
      this.logger.debug(
        `Server function ${customFunction.id} executed successfully with result: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Error executing server function ${customFunction.id}: ${error.message}`);
      const functionPath = `${customFunction.context ? `${customFunction.context}.` : ''}${customFunction.name}`;
      if (await this.eventService.sendErrorEvent(
        customFunction.id,
        executionEnvironment.id,
        executionEnvironment.tenantId,
        customFunction.visibility as Visibility,
        applicationId,
        userId,
        functionPath,
        this.eventService.getEventError(error),
      )) {
        return;
      }

      throw new HttpException(error.response?.data || error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateAllServerFunctions() {
    this.logger.debug('Updating all server functions...');
    const serverFunctions = await this.prisma.customFunction.findMany({
      where: {
        serverSide: true,
      },
      include: {
        environment: true,
      },
    });

    for (const serverFunction of serverFunctions) {
      const getApiKey = async () => {
        if (serverFunction.apiKey) {
          return serverFunction.apiKey;
        }
        const apiKeys = await this.authService.getAllApiKeys(serverFunction.environmentId);
        const adminApiKey = apiKeys.find((apiKey) => apiKey.user?.role === Role.Admin);
        return adminApiKey?.key;
      };

      const apiKey = serverFunction.apiKey || await getApiKey();
      if (!apiKey) {
        this.logger.error(`No API key found for server function ${serverFunction.id}`);
        continue;
      }

      this.logger.debug(`Updating server function ${serverFunction.id}...`);
      await this.faasService.updateFunction(
        serverFunction.id,
        serverFunction.environment.tenantId,
        serverFunction.environment.id,
        serverFunction.name,
        serverFunction.code,
        JSON.parse(serverFunction.requirements || '[]'),
        apiKey,
        await this.limitService.getTenantServerFunctionLimits(serverFunction.environment.tenantId),
        serverFunction.logsEnabled,
      );
    }
  }

  async toCustomFunctionSpecification(customFunction: CustomFunction): Promise<CustomFunctionSpecification | ServerFunctionSpecification> {
    const parsedArguments = JSON.parse(customFunction.arguments || '[]');

    const isReturnTypeSchema = (): boolean => {
      if (!customFunction.returnType) {
        return false;
      }
      try {
        JSON.parse(customFunction.returnType);
        return true;
      } catch (error) {
        // ignore, not a valid JSON schema
      }
      return false;
    };

    return {
      id: customFunction.id,
      type: customFunction.serverSide ? 'serverFunction' : 'customFunction',
      context: customFunction.context,
      name: customFunction.name,
      description: customFunction.description,
      requirements: JSON.parse(customFunction.requirements || '[]'),
      function: {
        arguments: await Promise.all(parsedArguments.map(arg => this.toArgumentSpecification(arg))),
        returnType: customFunction.returnType
          ? isReturnTypeSchema()
            ? {
                kind: 'object',
                schema: JSON.parse(customFunction.returnType),
              }
            : {
                kind: 'plain',
                value: customFunction.returnType,
              }
          : {
              kind: 'void',
            },
        synchronous: customFunction.synchronous,
      },
      code: customFunction.code,
      visibilityMetadata: {
        visibility: customFunction.visibility as Visibility,
      },
    };
  }

  async getServerFunctionLogs(id: string, keyword: string, logsEnabled: boolean): Promise<{logsEnabled: boolean, logs: FunctionLog[]}> {
    const logs = await this.faasLogsService.getLogs(id, keyword);
    return {
      logsEnabled,
      logs,
    };
  }

  private isGraphQLBody(body: Body): body is GraphQLBody {
    return body.mode === 'graphql';
  }

  async getFunctionsWithVariableArgument(environmentId: string, variablePath: string) {
    return this.prisma.apiFunction.findMany({
      where: {
        argumentsMetadata: {
          contains: `"variable":"${variablePath}"`,
        },
        environmentId,
      },
    });
  }

  async createOrUpdatePrebuiltBaseImage(user: AuthData) {
    const functionName = this.config.prebuiltBaseImageName;

    const code = `
      function ${functionName}(): void {};
    `;

    const customFunction = await this.createOrUpdateServerFunction(
      user.environment,
      '',
      functionName,
      '',
      code,
      {},
      user.key,
      false,
      () => Promise.resolve(),
      true,
    );

    return this.faasService.getFunctionName(customFunction.id);
  }

  private filterDisabledValues<T extends PostmanVariableEntry>(values: T[]) {
    return values.filter(({ disabled }) => !disabled);
  }

  private getBodyWithContentFiltered(body: Body): Body {
    switch (body.mode) {
      case 'raw':
        if (body.options?.raw?.language === 'json') {
          return {
            ...body,
            raw: this.jsonTemplate.filterComments(body.raw),
          };
        }
        return body;
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

  private getFilteredHeaders(headers: Header[]): Header[] {
    return this.filterDisabledValues(headers)
      .filter(({ key }) => !!key?.trim());
  }

  private getFunctionArguments(apiFunction: ApiFunctionArguments): FunctionArgument[] {
    const toArgument = (arg: string) => this.toArgument(arg, JSON.parse(apiFunction.argumentsMetadata || '{}'));
    const args: FunctionArgument[] = [];
    const parsedBody = JSON.parse(apiFunction.body || '{}');

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

    if (this.isGraphQLBody(parsedBody)) {
      const graphqlVariables = getGraphqlVariables(parsedBody.graphql.query);

      const graphqlFunctionArguments = graphqlVariables.map<FunctionArgument>(graphqlVariableDefinition => ({
        ...toArgument(graphqlVariableDefinition.variable.name.value),
        location: 'body',
      }));

      if (apiFunction.graphqlIntrospectionResponse) {
        args.push(...graphqlFunctionArguments);
      } else {
        const parsedGraphqlVariablesFromBody = JSON.parse(parsedBody.graphql.variables);
        args.push(...graphqlFunctionArguments.filter(argument => {
          const value = parsedGraphqlVariablesFromBody[argument.name];
          return typeof value !== 'undefined' && value !== null;
        }));
      }
    } else {
      args.push(...((apiFunction.body?.match(ARGUMENT_PATTERN)?.map<FunctionArgument>(arg => ({
        ...toArgument(arg),
        location: 'body',
      })) || []).filter(bodyArg => !args.some(arg => arg.key === bodyArg.key))));
    }

    args.sort(compareArgumentsByRequired);

    return uniqBy(args, 'key');
  }

  private toArgument(argument: string, argumentsMetadata: ArgumentsMetadata): FunctionArgument {
    return {
      key: argument,
      name: argumentsMetadata[argument]?.name || argument,
      description: argumentsMetadata[argument]?.description || '',
      type: argumentsMetadata[argument]?.type || 'string',
      typeObject: argumentsMetadata[argument]?.typeObject,
      typeSchema: argumentsMetadata[argument]?.typeSchema && JSON.stringify(argumentsMetadata[argument]?.typeSchema),
      payload: argumentsMetadata[argument]?.payload || false,
      required: argumentsMetadata[argument]?.required !== false,
      secure: argumentsMetadata[argument]?.secure || false,
      variable: argumentsMetadata[argument]?.variable || undefined,
      removeIfNotPresentOnExecute: argumentsMetadata[argument]?.removeIfNotPresentOnExecute,
    };
  }

  private async getArgumentValueMap(apiFunction: ApiFunction, args: Record<string, any>, normalizeArg = true) {
    const normalizeArgFn = (arg: any) => {
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
    const argumentValueMap = {};

    for (const arg of functionArgs) {
      if (arg.variable) {
        const variable = await this.variableService.findByPath(
          apiFunction.environmentId,
          'environment' in apiFunction ? (apiFunction.environment as Environment).tenantId : null,
          arg.variable,
        );
        argumentValueMap[arg.key] = variable ? await this.variableService.getVariableValue(variable) : undefined;
        this.logger.debug(`Argument '${arg.name}' resolved to variable ${variable?.id}`);
      } else if (arg.payload) {
        const payload = args['payload'];
        if (typeof payload !== 'object') {
          this.logger.debug(`Expecting payload as object, but it is not: ${JSON.stringify(payload)}`);
          continue;
        }
        argumentValueMap[arg.key] = normalizeArg ? normalizeArgFn(payload[arg.name]) : payload[arg.name];
      } else {
        argumentValueMap[arg.key] = normalizeArg ? normalizeArgFn(args[arg.name]) : args[arg.name];
      }
    }

    return argumentValueMap;
  }

  private async toArgumentSpecification(arg: FunctionArgument): Promise<PropertySpecification> {
    return {
      name: arg.name,
      description: arg.description,
      required: arg.required == null ? true : arg.required,
      type: await this.commonService.toPropertyType(arg.name, arg.type, arg.typeObject, arg.typeSchema && JSON.parse(arg.typeSchema)),
    };
  }

  private async toArgumentSpecifications(argumentsMetadata: ArgumentsMetadata): Promise<PropertySpecification[]> {
    const argumentSpecifications: PropertySpecification[] = [];

    for (const key of Object.keys(argumentsMetadata)) {
      argumentSpecifications.push(await this.toArgumentSpecification(this.toArgument(key, argumentsMetadata)));
    }

    return argumentSpecifications;
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
        throw new BadRequestException('Failed to create poly function: unambiguous function name');
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
        this.logger.debug('Unknown auth type:', auth);
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
      case 'graphql':
        return {
          query: body.graphql.query,
        };
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
    const { graphqlIntrospectionResponse } = apiFunction;

    const introspectionJSONSchema = graphqlIntrospectionResponse
      ? getJsonSchemaFromIntrospectionQuery(JSON.parse(graphqlIntrospectionResponse))
      : null;

    const functionArgs = this.getFunctionArguments(apiFunction);
    const newMetadata: ArgumentsMetadata = {};
    const metadata: ArgumentsMetadata = JSON.parse(apiFunction.argumentsMetadata || '{}');

    const parsedBody = JSON.parse(apiFunction.body || '{}');

    const isGraphQL = this.isGraphQLBody(parsedBody);

    const graphqlVariables = isGraphQL ? getGraphqlVariables(parsedBody.graphql.query) : null;

    const graphqlVariablesBody = isGraphQL ? JSON.parse(parsedBody.graphql.variables || '{}') : {};

    const resolvePayloadArguments = () => {
      if (functionArgs.length <= this.config.functionArgsParameterLimit) {
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
          if (newMetadata[arg.key]) {
            newMetadata[arg.key].payload = true;
          } else {
            newMetadata[arg.key] = {
              payload: true,
            };
          }
        }
      });
    };

    const assignNewMetadata = (arg: FunctionArgument, type: string, typeSchema: Record<string, any> | undefined, required?) => {
      if (newMetadata[arg.key]) {
        newMetadata[arg.key].type = type;
        newMetadata[arg.key].typeSchema = typeSchema;
        newMetadata[arg.key].required = required;
      } else {
        newMetadata[arg.key] = {
          type,
          typeSchema,
          required,
        };
      }
    };

    const resolveArgumentTypes = async () => {
      if (debug) {
        if (apiFunction.id) {
          this.logger.debug(`Resolving argument types for function ${apiFunction.id}...`);
        } else {
          this.logger.debug('Resolving argument types for new function...');
        }
      }

      for (const arg of functionArgs) {
        if (metadata[arg.key]?.type) {
          newMetadata[arg.key] = {
            ...newMetadata[arg.key],
            ...omit(metadata[arg.key], 'payload'),
          };
          continue;
        }
        const value = variables[arg.key];

        if (isGraphQL && arg.location === 'body') {
          for (const graphqlVariable of (graphqlVariables as VariableDefinitionNode[])) {
            const graphqlVariableName = graphqlVariable.variable.name.value;
            if (graphqlVariableName !== arg.name) {
              continue;
            }

            if (introspectionJSONSchema) {
              const {
                required,
                type,
                typeSchema,
              } = resolveGraphqlArgumentType(graphqlVariable.type, introspectionJSONSchema);

              assignNewMetadata(arg, type, typeSchema, required);
            } else {
              const graphqlVariableBodyValue = graphqlVariablesBody[graphqlVariableName];

              if (typeof graphqlVariableBodyValue !== 'undefined') {
                const [type, typeSchema] = await this.resolveArgumentType(JSON.stringify(graphqlVariableBodyValue));

                assignNewMetadata(arg, type, typeSchema);
              }
            }
          }
        } else {
          const [type, typeSchema] = value == null ? ['string'] : await this.resolveArgumentType(this.unpackArgsAndGetValue(value, variables));

          assignNewMetadata(arg, type, typeSchema);
        }
      }
    };

    const resolveSecureArguments = () => {
      functionArgs.forEach((arg) => {
        if (arg.location === 'auth') {
          if (newMetadata[arg.key]) {
            newMetadata[arg.key].secure = true;
          } else {
            newMetadata[arg.key] = {
              secure: true,
            };
          }
        }
      });
    };

    await resolvePayloadArguments();
    await resolveSecureArguments();
    await resolveArgumentTypes();

    return newMetadata;
  }

  private async resolveArgumentType(value: string) {
    return this.commonService.resolveType('Argument', value);
  }

  private async resolveArgumentsTypeSchema(apiFunction: ApiFunction, argumentsMetadata: ArgumentsMetadata) {
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
      } else if (argMetadata.typeSchema) {
        let typeSchema: Record<string, any>;
        try {
          typeSchema = typeof argMetadata.typeSchema === 'object'
            ? argMetadata.typeSchema
            : JSON.parse(argMetadata.typeSchema);
        } catch (e) {
          throw new BadRequestException(`Argument '${argKey}' with typeSchema='${argMetadata.typeSchema}' is invalid`);
        }
        if (!await this.commonService.validateJsonMetaSchema(typeSchema)) {
          throw new BadRequestException(`Argument '${argKey}' with typeSchema='${argMetadata.typeSchema}' is not valid JSON schema`);
        }
      }
    }

    return argumentsMetadata;
  }

  private async checkArgumentsMetadata(apiFunction: ApiFunction, argumentsMetadata: ArgumentsMetadata) {
    const functionArgs = this.getFunctionArguments(apiFunction);

    for (const key of Object.keys(argumentsMetadata)) {
      const argMetadata = argumentsMetadata[key];
      if (!functionArgs.find((arg) => arg.key === key)) {
        throw new BadRequestException(`Argument '${key}' not found in function`);
      }
      if (argMetadata.variable) {
        const variable = await this.variableService.findByPath(
          apiFunction.environmentId,
          'environment' in apiFunction ? (apiFunction.environment as Environment).tenantId : null,
          argMetadata.variable,
        );
        if (!variable) {
          throw new BadRequestException(`Variable on path '${argMetadata.variable}' not found.`);
        }
      }
    }
  }

  private mergeArgumentsMetadata(argumentsMetadata: string | null, updatedArgumentsMetadata: ArgumentsMetadata | null): ArgumentsMetadata {
    return mergeWith(JSON.parse(argumentsMetadata || '{}') as ArgumentsMetadata, updatedArgumentsMetadata || {}, (objValue, srcValue) => {
      if (objValue?.typeObject && srcValue?.typeObject) {
        return {
          ...objValue,
          ...srcValue,
          typeObject: srcValue.typeObject,
        };
      }
      if (Array.isArray(objValue) && Array.isArray(srcValue)) {
        return srcValue;
      }
    });
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

    for (const currentApiFunction of apiFunctions) {
      const newArgumentsMetaData = await this.resolveArgumentsMetadata(
        {
          argumentsMetadata: currentApiFunction.argumentsMetadata,
          auth,
          body,
          headers,
          url,
          id: currentApiFunction.id,
          graphqlIntrospectionResponse: null,
        },
        variables,
      );

      const parsedCurrentArgumentsMetaData = JSON.parse(
        currentApiFunction.argumentsMetadata || '{}',
      ) as ArgumentsMetadata;

      const equalArgumentsCount = Object.keys(parsedCurrentArgumentsMetaData).length === Object.keys(newArgumentsMetaData).length;
      if (equalArgumentsCount && apiFunction) {
        throw new BadRequestException('There exist more than 1 api function with same arguments, use { id: string } on polyData Postman environment variable to specify which one do you want to retrain.');
      }

      // Check arguments length difference.
      if (!equalArgumentsCount) {
        continue;
      }

      // Check arguments type difference.
      if (
        !Object.keys(parsedCurrentArgumentsMetaData).every((key) => {
          return (
            newArgumentsMetaData.hasOwnProperty(key) &&
            parsedCurrentArgumentsMetaData[key].type === newArgumentsMetaData[key].type
          );
        })
      ) {
        continue;
      }

      apiFunction = currentApiFunction;
    }

    return apiFunction;
  }

  private async getCustomFunctionAIData(tenantId: string, description: string, args: FunctionArgument[], code: string) {
    const {
      description: aiDescription,
      arguments: aiArguments,
      trace_id: traceId,
    } = await this.aiService.getFunctionDescription(
      tenantId,
      '',
      '',
      description,
      await Promise.all(args.map(arg => this.toArgumentSpecification(arg))),
      '',
      '',
      code,
    );

    return {
      description: aiDescription,
      arguments: aiArguments || [],
      traceId,
    };
  }

  private async isApiFunctionAITrainingEnabled(environment: Environment) {
    const trainingDataCfgVariable = await this.configVariableService.getOneParsed<TrainingDataGeneration>(ConfigVariableName.TrainingDataGeneration, environment.tenantId, environment.id);

    return trainingDataCfgVariable?.value.apiFunctions;
  }

  private async isCustomFunctionAITrainingEnabled(environment: Environment, serverFunction: boolean) {
    const trainingDataCfgVariable = await this.configVariableService.getOneParsed<TrainingDataGeneration>(ConfigVariableName.TrainingDataGeneration, environment.tenantId, environment.id);

    return (trainingDataCfgVariable?.value.clientFunctions && !serverFunction) || (trainingDataCfgVariable?.value.serverFunctions && serverFunction);
  }

  private async getResponseType(response: any, payload: string | null): Promise<string> {
    const responseObject = response
      ? this.commonService.getPathContent(response, payload)
      : null;
    const [type, typeSchema] = responseObject
      ? await this.commonService.resolveType('ResponseType', JSON.stringify(responseObject))
      : ['void'];

    return type === 'object' ? JSON.stringify(typeSchema) : type;
  }

  private async resolveVisibility<T extends { environment: Environment & { tenant: Tenant }, context: string | null }>(
    tenant: Tenant,
    environment: Environment,
    entity: T,
  ): Promise<T & { hidden: boolean }> {
    const {
      defaultHidden = false,
      visibleContexts = null,
    } = await this.configVariableService.getEffectiveValue<PublicVisibilityValue>(
      ConfigVariableName.PublicVisibility,
      tenant.id,
      environment.id,
    ) || {};

    return {
      ...entity,
      hidden: !this.commonService.isPublicVisibilityAllowed(entity, defaultHidden, visibleContexts),
    };
  }

  private getBodySource(body: Body) {
    switch (body.mode) {
      case 'raw':
        return {
          raw: body.raw,
        };

      case 'formdata':
        return {
          formdata: body.formdata,
        };
      case 'urlencoded':
        return {
          urlencoded: body.urlencoded,
        };
      case 'graphql':
        return {
          graphql: {
            query: body.graphql.query,
          },
        };
    }

    return {
      mode: ('empty' as const),
    };
  }

  private mergeCustomFunctionArgumentsMetadata(argumentsMetadataString: string, updatedArgumentsMetadata: ArgumentsMetadata) {
    const argumentsMetadata = JSON.parse(argumentsMetadataString || '[]');

    return argumentsMetadata.reduce((acum, argument) => {
      return acum.concat({
        ...argument,
        ...updatedArgumentsMetadata[argument.key],
      });
    }, []);
  }

  /**
   * Process and unpack nested args for value.
   */
  private unpackArgsAndGetValue(value: string, variables: Variables) {
    const result = mustache.render(value, variables, {}, {
      escape(text) {
        return text;
      },
    });

    // Get args list.
    const args = mustache.parse(result).filter((row) => row[0] === 'name');

    if (args.length) {
      return this.unpackArgsAndGetValue(result, variables);
    }

    return result;
  }

  private getReturnTypeData(returnType: string | null): [string, Record<string, any> | undefined] {
    try {
      const typeSchema = returnType ? JSON.parse(returnType) : undefined;
      return ['object', typeSchema];
    } catch (e) {
      return ['string', undefined];
    }
  }
}
