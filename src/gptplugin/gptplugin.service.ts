import fs from 'fs';
import handlebars from 'handlebars';
import lodash from 'lodash';
import convert from '@openapi-contrib/json-schema-to-openapi-schema';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from 'prisma/prisma.service';
import { CreatePluginDto, PropertySpecification, PropertyType, Specification } from '@poly/common';
import { FunctionService } from 'function/function.service';
import { ApiFunction, CustomFunction, GptPlugin, Environment } from '@prisma/client';
import { Request } from 'express';

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
  executePath: string;
  operationId: string;
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

function rsplit(s: string, sep: string, maxsplit: number): string[] {
  const split = s.split(sep);
  return [split.slice(0, -maxsplit).join(sep)].concat(split.slice(-maxsplit));
}

function _getExecuteType(t: string) {
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
}

function _getArgumentsRequired(args: PropertySpecification[]): string[] {
  const rv: string[] = [];
  for (const arg of args) {
    if (arg.required) {
      rv.push(arg.name);
    }
  }
  return rv;
}

const _getOpenApiType = (t: PropertyType): string => {
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

function _cleanupProperties(properties: object) {
  for (const [key, value] of Object.entries(properties)) {
    if (value.$ref) {
      delete properties[key];
    }
  }
}

async function _getResponseSchema(f: PluginFunction) {
  // @ts-expect-error: it's ok
  const jsonSchema = f.function.returnType.schema;
  const type = _getOpenApiType(f.function.returnType);

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
    _cleanupProperties(schema.properties);
  }

  return {
    name: `${f.operationId}Response`,
    schema: JSON.stringify(schema, null, 2),
  };
}

const _getOperationId = (f: NameContext): string => {
  // HACK this could be way more efficient, oh well
  let parts: string[] = [...f.context.split('.'), ...f.name.split('.')];
  parts = parts.map((s) => lodash.startCase(s));
  return lodash.camelCase(parts.join(''));
};

function _trimDescription(desc: string | undefined): string {
  if (!desc) {
    return '';
  }
  // openapi limit for description is 300. truncate!
  // there are some escapes for html which count as extra chars so limit to 250 to be safe
  if (desc.length > 250) {
    return desc.substring(0, 250);
  }
  return desc;
}

function _tweakSpecForPlugin(f: AnyFunction, details: Specification): PluginFunction {
  details.description = _trimDescription(details.description);
  const executeType = _getExecuteType(details.type);
  return {
    executePath: `/functions/${executeType}/${f.id}/execute`,
    operationId: _getOperationId(f),
    ...details,
  };
}

async function _apiFunctionMap(f: ApiFunction, functionService: FunctionService): Promise<PluginFunction> {
  const details = await functionService.toApiFunctionSpecification(f);
  const pluginFunc = _tweakSpecForPlugin(f, details);
  return new Promise((resolve) => {
    resolve(pluginFunc);
  });
}

async function _customFunctionMap(f: CustomFunction, functionService: FunctionService): Promise<PluginFunction> {
  const details = await functionService.toCustomFunctionSpecification(f);
  const pluginFunc = _tweakSpecForPlugin(f, details);
  return new Promise((resolve) => {
    resolve(pluginFunc);
  });
}

function _getProperties(props: PropertySpecification[]) {
  const rv: object = {};
  for (const prop of props) {
    const type = _getOpenApiType(prop.type);
    const name = prop.name;
    rv[name] = { type };
    if (type === 'object') {
      // @ts-expect-error: we know from previous line this is object!
      const properties: PropertySpecification[] = prop.type.properties;
      if (properties && properties.length > 0) {
        rv[name].properties = _getProperties(properties);
        rv[name].required = _getArgumentsRequired(properties);
      }
    }
  }
  return rv;
}

function _validateName(name: string): string {
  if (name.length > 30) {
    throw new BadRequestException('Name too long. Max name length is 30 characters!');
  }
  return name;
}

@Injectable()
export class GptPluginService {
  private readonly logger = new Logger(GptPluginService.name);

  constructor(
    private readonly functionService: FunctionService,
    // TODO use with updatePlugin endpoint?
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async _getAllFunctions(environmentId: string, ids: string[]): Promise<PluginFunction[]> {
    // TODO lets filter these down to just supported functions?
    const apiFunctions = await this.functionService.getApiFunctions(environmentId, [], [], ids, true, true);
    const customFunctions = await this.functionService.getServerFunctions(environmentId, [], [], ids);
    // const authFunctions = await this.prisma.authFunction.findMany({ where: { publicId: { in: publicIds } } });

    let promises = apiFunctions.map((apiFunction) => _apiFunctionMap(apiFunction, this.functionService));
    promises = promises.concat(
      customFunctions.map((customFunction) => _customFunctionMap(customFunction, this.functionService)),
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
    const plugin = await this.prisma.gptPlugin.findUniqueOrThrow({
      where: { slug },
    });

    const functionIds = JSON.parse(plugin.functionIds);
    const functions = await this._getAllFunctions(plugin.environmentId, functionIds);

    // @ts-expect-error: filter gets rid of nulls
    const bodySchemas: Schema[] = functions.map((f) => this.getBodySchema(f)).filter((s) => s !== null);

    const responseSchemas = await Promise.all(functions.map((f) => _getResponseSchema(f)));

    const template = handlebars.compile(this.loadTemplate());
    return template({ plugin, hostname, functions, bodySchemas, responseSchemas });
  }

  getBodySchema = (f: PluginFunction): object | null => {
    if (!f.function.arguments || f.function.arguments.length === 0) {
      return null;
    }
    const schema = {
      type: 'object',
      properties: _getProperties(f.function.arguments),
      required: _getArgumentsRequired(f.function.arguments),
    };
    return {
      name: `${f.operationId}Body`,
      schema: JSON.stringify(schema, null, 2),
    };
  };

  async getPlugin(slug: string): Promise<GptPlugin> {
    return this.prisma.gptPlugin.findUniqueOrThrow({
      where: { slug },
    });
  }

  async createOrUpdatePlugin(environment: Environment, body: CreatePluginDto): Promise<GptPlugin> {
    // slugs must be lowercase!
    body.slug = body.slug.toLowerCase();

    // permission check
    const plugin = await this.prisma.gptPlugin.findUnique({ where: { slug: body.slug } });
    if (plugin && plugin.environmentId !== environment.id) {
      throw new Error('Plugin is in different environment, cannot access with this key');
    }

    // function check
    const functionIds = body.functionIds ? JSON.stringify(body.functionIds) : '';

    if (body.functionIds) {
      const functions = await this._getAllFunctions(environment.id, body.functionIds);
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
      update['name'] = _validateName(body.name);
    }
    if (body.contactEmail) {
      update['contactEmail'] = body.contactEmail;
    }
    if (body.legalUrl) {
      update['legalUrl'] = body.legalUrl;
    }
    if (body.descriptionForMarketplace) {
      update['descriptionForMarketplace'] = body.descriptionForMarketplace;
    }
    if (body.descriptionForModel) {
      update['descriptionForModel'] = body.descriptionForModel;
    }
    if (body.iconUrl) {
      update['iconUrl'] = body.iconUrl;
    }
    if (functionIds) {
      update['functionIds'] = functionIds;
    }

    return this.prisma.gptPlugin.upsert({
      where: {
        slug: body.slug,
      },
      update: { ...update },
      create: {
        slug: body.slug,
        name: _validateName(body.name ? body.name : body.slug),
        contactEmail: body.contactEmail ? body.contactEmail : 'info@polyapi.io',
        legalUrl: body.legalUrl ? body.legalUrl : 'https://polyapi.io/legal',
        descriptionForMarketplace: body.descriptionForMarketplace || '',
        descriptionForModel: body.descriptionForModel || '',
        iconUrl: body.iconUrl ? body.iconUrl : POLY_DEFAULT_ICON_URL,
        environmentId: environment.id,
        functionIds,
      },
    });
  }

  async getManifest(req: Request) {
    const host = req.hostname;
    const slugEnv = host.split('.')[0];
    const parts = rsplit(slugEnv, '-', 1);
    const slug = parts[0];
    const env = parts[1];

    // make sure this is valid plugin host
    let name = '';
    let descMarket = 'Ask ChatGPT to compose and execute chains of tasks on Poly API';
    let descModel = 'Ask ChatGPT to compose and execute chains of tasks on Poly API';
    let iconUrl = 'https://polyapi.io/wp-content/uploads/2023/03/poly-block-logo-mark.png';
    let contactEmail = 'info@polyapi.io';
    let legalUrl = 'https://polyapi.io/legal';

    const auth = {
      type: 'user_http',
      authorization_type: 'bearer',
    };
    if (slug === 'staging') {
      name = 'Poly API Staging';
    } else if (slug === 'develop') {
      name = 'Poly API Develop';
    } else if (slug === LOCALHOST_PAGEKITE) {
      name = 'Poly API Local';
    } else {
      const plugin = await this.prisma.gptPlugin.findUniqueOrThrow({ where: { slug }, include: { environment: true } });
      if (plugin.environment.subdomain !== env) {
        throw new BadRequestException('Plugin subdomain does not match environment!');
      }
      name = plugin.name;
      descMarket = plugin.descriptionForMarketplace;
      descModel = plugin.descriptionForModel;
      iconUrl = plugin.iconUrl;
      contactEmail = plugin.contactEmail;
      legalUrl = plugin.legalUrl;
    }

    return {
      schema_version: 'v1',
      name_for_human: name,
      name_for_model: lodash.snakeCase(name),
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
}
