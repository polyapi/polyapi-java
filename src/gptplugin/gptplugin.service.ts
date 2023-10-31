import fs from 'fs';
import handlebars from 'handlebars';
import _ from 'lodash';
import convert from '@openapi-contrib/json-schema-to-openapi-schema';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AiService } from 'ai/ai.service';
import { PrismaService } from 'prisma-module/prisma.service';
import {
  ApiFunctionSpecification,
  CreatePluginDto,
  CustomFunctionSpecification,
  FunctionSpecification,
  PropertySpecification,
  PropertyType,
  ServerFunctionSpecification,
  Specification,
} from '@poly/model';
import { FunctionService } from 'function/function.service';
import { Prisma, Conversation, ApiFunction, CustomFunction, GptPlugin, Environment } from '@prisma/client';
import { Request } from 'express';
import { AuthService } from 'auth/auth.service';
import { AuthData } from 'common/types';

const POLY_DEFAULT_ICON_URL = 'https://polyapi.io/wp-content/uploads/2023/03/poly-block-logo-mark.png';
// for testing locally
// what is the slug you chose for your pagekite?
// see pagekite.me
const LOCALHOST_PAGEKITE = 'megatronical';

type AnyFunction = ApiFunction | CustomFunction;

type NameContext = {
  name: string;
  context: string;
};

export type PluginFunction = Specification & {
  function: FunctionSpecification;
  executePath: string;
  operationId: string;
};

type PluginAuth = {
  type: string;
  authorization_type: string;
  verification_tokens?: object;
};

type OpenApiResponse = {
  type: string;
  properties?: object;
  description?: string;
  required?: string[];
};

type Schema = {
  name: string;
  type: string;
  description: string;
  arguments?: object;
  argumentsRequired?: string[];
};

const rsplit = (s: string, sep: string, maxsplit: number): string[] => {
  const split = s.split(sep);
  return [split.slice(0, -maxsplit).join(sep)].concat(split.slice(-maxsplit));
};

const slugify = (str: string): string => {
  return String(str)
    .normalize('NFKD') // split accented characters into their base characters and diacritical marks
    .replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
    .trim() // trim leading or trailing whitespace
    .toLowerCase() // convert to lowercase
    .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-'); // remove consecutive hyphens
};

export const getSlugSubdomain = (host: string): [string, string] => {
  const slugEnv = host.split('.')[0];
  const parts = rsplit(slugEnv, '-', 1);
  let slug = parts[0];
  let subdomain = parts[1];
  if (subdomain === LOCALHOST_PAGEKITE) {
    // HACK hardcode this for local testing
    slug = LOCALHOST_PAGEKITE;
    subdomain = '69a4f5f0';
  }
  return [slug, subdomain];
};

const getExecuteType = (t: string): string => {
  switch (t) {
    case 'apiFunction':
      return 'api';
    case 'customFunction':
      return 'server';
    case 'serverFunction':
      return 'server';
    default:
      return 'unknown';
  }
};

const getArgumentsRequired = (args: PropertySpecification[]): string[] => {
  const rv: string[] = [];
  for (const arg of args) {
    if (arg.required) {
      rv.push(arg.name);
    }
  }
  return rv;
};

const getOpenApiType = (t: PropertyType): string => {
  if (t.kind === 'void') {
    return 'string';
  } else if (t.kind === 'plain') {
    if (t.value === 'string' || t.value === 'number' || t.value === 'boolean') {
      return t.value;
    } else {
      // HACK just return string for now
      return 'string';
    }
  } else if (t.kind === 'primitive') {
    return t.type;
  } else if (t.kind === 'function') {
    throw new BadRequestException('Cannot support functions as return types yet');
  } else {
    return t.kind;
  }
};

const cleanupProperties = (properties: object) => {
  for (const [key, value] of Object.entries(properties)) {
    if (value.$ref) {
      delete properties[key];
    }
  }
};

const getResponseSchema = async (f: PluginFunction) => {
  // @ts-expect-error: it's ok
  const jsonSchema = f.function.returnType.schema;
  const type = getOpenApiType(f.function.returnType);

  let converted: null | OpenApiResponse = null;
  if (jsonSchema && type === 'object') {
    const temp = (await convert(jsonSchema)) as unknown;
    converted = temp as OpenApiResponse;
  }

  const schema: OpenApiResponse = {
    type,
    description: 'response',
    properties: {},
  };
  if (converted?.properties) {
    schema.properties = converted.properties;
    cleanupProperties(schema.properties);
  }

  return {
    name: `${f.operationId}Response`,
    schema: JSON.stringify(schema, null, 2),
  };
};

const getOperationId = (f: NameContext): string => {
  // HACK this could be way more efficient, oh well
  let parts: string[] = [...f.context.split('.'), ...f.name.split('.')];
  parts = parts.map((s) => _.startCase(s));
  return _.camelCase(parts.join(''));
};

const trimDescription = (desc: string | undefined): string => {
  if (!desc) {
    return '';
  }
  // openapi limit for description is 300. truncate!
  // there are some escapes for html which count as extra chars so limit to 250 to be safe
  if (desc.length > 250) {
    return desc.substring(0, 250);
  }
  return desc;
};

const tweakSpecForPlugin = (
  f: AnyFunction,
  details: ApiFunctionSpecification | CustomFunctionSpecification | ServerFunctionSpecification,
): PluginFunction => {
  details.description = trimDescription(details.description);
  const executeType = getExecuteType(details.type);
  return {
    executePath: `/functions/${executeType}/${f.id}/execute`,
    operationId: getOperationId(f),
    ...details,
  };
};

const apiFunctionMap = async (f: ApiFunction, functionService: FunctionService): Promise<PluginFunction> => {
  const details = await functionService.toApiFunctionSpecification(f);
  const pluginFunc = tweakSpecForPlugin(f, details);
  return new Promise((resolve) => {
    resolve(pluginFunc);
  });
};

const customFunctionMap = async (f: CustomFunction, functionService: FunctionService): Promise<PluginFunction> => {
  const details = await functionService.toCustomFunctionSpecification(f);
  const pluginFunc = tweakSpecForPlugin(f, details);
  return new Promise((resolve) => {
    resolve(pluginFunc);
  });
};

const getProperties = (props: PropertySpecification[]) => {
  const rv: object = {};
  for (const prop of props) {
    const type = getOpenApiType(prop.type);
    const name = prop.name;
    rv[name] = { type };
    if (prop.description) {
      rv[name].description = prop.description;
    }
    if (type === 'object' && prop.type.kind === 'object') {
      const { properties, schema } = prop.type;
      if (properties && properties.length > 0) {
        rv[name].properties = getProperties(properties);
        rv[name].required = getArgumentsRequired(properties);
      } else if (schema) {
        rv[name] = _.omit(schema, '$schema');
      }
    }
  }
  return rv;
};

const validateName = (key: string, name: string): string => {
  if (name && name.length > 30) {
    throw new BadRequestException('Name too long. Max name length is 30 characters!');
  }
  return name;
};

const _validateDesc = (key: string, desc: string): string => {
  if (desc && desc.length > 120) {
    throw new BadRequestException('Description for marketplace too long. Max desc length is 120 characters!');
  }
  return desc;
};

const _validateDescForModel = (key: string, desc: string): string => {
  if (desc && desc.length > 7900) {
    throw new BadRequestException('Description for model too long. Max desc length is 8000 characters!');
  }
  return desc;
};

const _noValidation = (key, val) => val;

const requireOrThrow = (key: string, val) => {
  // if no value, throw an exception!
  if (val) {
    return val;
  } else {
    throw new BadRequestException(`Required field ${key} not passed!`);
  }
};

const SIMPLE_FIELD_VALIDATORS: { [key: string]: null | CallableFunction } = {
  contactEmail: requireOrThrow,
  legalUrl: requireOrThrow,
  name: validateName,
  descriptionForMarketplace: _validateDesc,
  descriptionForModel: _validateDescForModel,
  iconUrl: null,
  authType: null,
  authToken: null,
};

@Injectable()
export class GptPluginService {
  private readonly logger = new Logger(GptPluginService.name);

  constructor(
    private readonly functionService: FunctionService,
    private readonly aiService: AiService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async getAllFunctions(environmentId: string, tenantId: string, ids: string[]): Promise<PluginFunction[]> {
    // TODO lets filter these down to just supported functions?
    const apiFunctions = await this.functionService.getApiFunctions(
      environmentId,
      [],
      [],
      ids,
      {
        includePublic: true,
        tenantId,
      },
      true,
    );
    const customFunctions = await this.functionService.getServerFunctions(environmentId, [], [], ids);
    // const authFunctions = await this.prisma.authFunction.findMany({ where: { publicId: { in: publicIds } } });

    let promises = apiFunctions.map((apiFunction) => apiFunctionMap(apiFunction, this.functionService));
    promises = promises.concat(
      customFunctions.map((customFunction) => customFunctionMap(customFunction, this.functionService)),
    );

    const functions = Promise.all(promises);
    return functions;
  }

  getOpenApiUrl(host: string, slug: string): string {
    const protocol = host === 'localhost' ? 'http' : 'https';
    if (slug === 'develop' || slug === 'staging') {
      // HACK for now staging/develop/local just use hardcoded manifests
      return `${protocol}://${host}/openapi-${slug}.yaml`;
    } else if (slug === LOCALHOST_PAGEKITE) {
      return `${protocol}://${LOCALHOST_PAGEKITE}.pagekite.me/openapi-localhost.yaml`;
    } else {
      return `${protocol}://${host}/plugins/${slug}/openapi`;
    }
  }

  getTemplatePath(): string {
    // make this a function so we can mock it
    return `${process.cwd()}/dist/gptplugin/templates/openapi.json.hbs`;
  }

  loadTemplate(): string {
    return fs.readFileSync(
      // HACK this feels super hardcody
      this.getTemplatePath(),
      'utf8',
    );
  }

  async getOpenApiSpec(hostname: string, slug: string): Promise<string> {
    const [, subdomain] = getSlugSubdomain(hostname);
    const environment = await this.prisma.environment.findUniqueOrThrow({ where: { subdomain } });
    const plugin = await this.prisma.gptPlugin.findUniqueOrThrow({
      where: { slug_environmentId: { slug, environmentId: environment.id } },
    });

    const functionIds = plugin.functionIds ? JSON.parse(plugin.functionIds) : [];
    const functions = await this.getAllFunctions(plugin.environmentId, environment.tenantId, functionIds);

    // @ts-expect-error fixme
    const bodySchemas: Schema[] = functions.map((f) => this.getBodySchema(f)).filter((s) => s !== null);

    const responseSchemas = await Promise.all(functions.map((f) => getResponseSchema(f)));

    const template = handlebars.compile(this.loadTemplate());
    return template({ plugin, hostname, functions, bodySchemas, responseSchemas });
  }

  getBodySchema = (f: PluginFunction): object | null => {
    if (!f.function.arguments || f.function.arguments.length === 0) {
      return null;
    }
    const schema = {
      type: 'object',
      properties: getProperties(f.function.arguments),
      required: getArgumentsRequired(f.function.arguments),
    };
    return {
      name: `${f.operationId}Body`,
      schema: JSON.stringify(schema, null, 2),
    };
  };

  async getPlugin(slug: string, environmentId, include: any = null): Promise<GptPlugin> {
    try {
      return await this.prisma.gptPlugin.findUniqueOrThrow({
        where: { slug_environmentId: { slug, environmentId } },
        include,
      });
    } catch {
      throw new NotFoundException(`Plugin with slug ${slug} not found!`);
    }
  }

  async listPlugins(environmentId: string): Promise<GptPlugin[]> {
    return this.prisma.gptPlugin.findMany({
      where: { environmentId },
      orderBy: { slug: 'asc' },
    });
  }

  async deletePlugin(slug: string, environmentId: string): Promise<unknown> {
    try {
      return await this.prisma.gptPlugin.delete({
        where: { slug_environmentId: { slug, environmentId } },
      });
    } catch {
      throw new NotFoundException(`Plugin with slug ${slug} not found!`);
    }
  }

  async createOrUpdatePlugin(environment: Environment, body: CreatePluginDto): Promise<GptPlugin> {
    // user_http is not working atm
    if (body.authType === 'user_http') {
      throw new BadRequestException(
        '`user_http` authentication is not supported by OpenAI at the moment. see OpenAI docs for details. Please use service_http!',
      );
    }

    // slugs must be lowercase!
    body.slug = body.slug.replaceAll('_', '-');
    body.slug = slugify(body.slug);

    // function check
    const functionIds = body.functionIds ? JSON.stringify(body.functionIds) : '';

    if (body.functionIds) {
      const functions = await this.getAllFunctions(environment.id, environment.tenantId, body.functionIds);
      if (functions.length !== body.functionIds.length) {
        const badFunctionIds: string[] = [];
        const goodFunctionIds = functions.map((f) => f.id);
        for (const fid of body.functionIds) {
          if (!goodFunctionIds.includes(fid)) {
            badFunctionIds.push(fid);
          }
        }
        throw new BadRequestException(
          `Invalid function ids ${badFunctionIds} passed in functionIds. Are you sure this is the right environment and that the function type is supported?`,
        );
      }
    }

    // ok lets go ahead and create or update!
    const update = {};

    if (body.name) {
      update['name'] = validateName('name', body.name);
    }

    if (functionIds) {
      update['functionIds'] = functionIds;
    }

    for (const [key, val] of Object.entries(body)) {
      if (key in SIMPLE_FIELD_VALIDATORS) {
        const validator: CallableFunction = SIMPLE_FIELD_VALIDATORS[key] || _noValidation;
        update[key] = validator(key, val);
      } else {
        // key is not simple to validate, the validate logic lies elsewhere
        // (probably directly above here)
      }
    }

    const existingPlugin = await this.prisma.gptPlugin.findFirst({
      where: {
        slug: body.slug,
        environmentId: environment.id,
      },
    });
    if (!existingPlugin) {
      // do create-only validation!
      requireOrThrow('legalUrl', body.legalUrl);
      requireOrThrow('contactEmail', body.contactEmail);
    }

    return this.prisma.gptPlugin.upsert({
      where: {
        slug_environmentId: { slug: body.slug, environmentId: environment.id },
      },
      update: { ...update },
      create: {
        ...update,
        // list them all explicitly so we pass type checking and can set defaults
        slug: body.slug,
        name: validateName('name', body.name ? body.name : body.slug),
        contactEmail: body.contactEmail,
        legalUrl: body.legalUrl,
        iconUrl: body.iconUrl ? body.iconUrl : POLY_DEFAULT_ICON_URL,
        environmentId: environment.id,
        functionIds,
      },
    });
  }

  async getManifest(req: Request) {
    const host = req.hostname;
    const [slug, subdomain] = getSlugSubdomain(host);
    const environment = await this.prisma.environment.findUniqueOrThrow({ where: { subdomain } });

    // make sure this is valid plugin host
    let name = '';
    let descMarket = 'Ask ChatGPT to compose and execute chains of tasks on Poly API';
    let descModel = 'Ask ChatGPT to compose and execute chains of tasks on Poly API';
    let iconUrl = 'https://polyapi.io/wp-content/uploads/2023/03/poly-block-logo-mark.png';
    let contactEmail = 'info@polyapi.io';
    let legalUrl = 'https://polyapi.io/legal';

    // default to user auth
    const plugin = await this.getPlugin(slug, environment.id, { environment: true });
    const auth: PluginAuth = {
      type: plugin.authType,
      authorization_type: 'bearer',
    };
    if (plugin.authType === 'service_http') {
      auth.verification_tokens = { openai: plugin.authToken };
    }
    name = plugin.name;
    descMarket = plugin.descriptionForMarketplace;
    descModel = plugin.descriptionForModel;
    iconUrl = plugin.iconUrl;
    contactEmail = plugin.contactEmail;
    legalUrl = plugin.legalUrl;

    return {
      schema_version: 'v1',
      name_for_human: name,
      name_for_model: _.snakeCase(name),
      description_for_human: descMarket,
      description_for_model: descModel,
      auth,
      api: {
        type: 'openapi',
        url: this.getOpenApiUrl(host, slug),
        is_user_authenticated: false,
      },
      logo_url: iconUrl,
      contact_email: contactEmail,
      legal_info_url: legalUrl,
    };
  }

  async chat(authData: AuthData, slug: string, conversationSlug: string, message: string) {
    const where = this._getConversationWhereInput(authData, conversationSlug);
    let conversation = await this.prisma.conversation.findFirst({ where });
    if (!conversation) {
      conversation = await this._createConversation(authData, conversationSlug);
    }

    const plugin = await this.getPlugin(slug, authData.environment.id);
    const hashedKey = await this.authService.hashApiKey(authData.key);
    const apiKey = await this.prisma.apiKey.findUniqueOrThrow({ where: { key: hashedKey } });
    return await this.aiService.pluginChat(authData.key, apiKey.id, plugin.id, conversation.id, message);
  }

  private async _createConversation(authData: AuthData, conversationSlug: string): Promise<Conversation> {
    return this.prisma.conversation.create({
      data: {
        applicationId: authData.application?.id,
        userId: authData.user?.id,
        slug: conversationSlug,
      },
    });
  }

  // HACK copypasta from chat.service.ts
  _getConversationWhereInput(authData: AuthData, conversationSlug: string): Prisma.ConversationWhereInput {
    let where: Prisma.ConversationWhereInput = {};
    if (authData.user) {
      where = { userId: authData.user.id, slug: conversationSlug };
    } else if (authData.application) {
      where = { applicationId: authData.application.id, slug: conversationSlug };
    } else {
      throw new BadRequestException('user or application is required');
    }
    return where;
  }
}
