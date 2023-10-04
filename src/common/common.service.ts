import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InputData, jsonInputForTargetLanguage, quicktype } from 'quicktype-core';
import jsonpath from 'jsonpath';
import { validator } from '@exodus/schemasafe';
import axios from 'axios';
import _ from 'lodash';
import { toPascalCase } from '@guanghechen/helper-string';
import { ConfigVariable, Environment, Prisma, Tenant } from '@prisma/client';
import { CommentToken, parse, stringify } from 'comment-json';
import { ConfigService } from 'config/config.service';
import { PathError } from './path-error';
import {
  ArgumentType,
  CONTEXT_ALLOWED_CHARACTERS_PATTERN,
  DOTS_AT_BEGINNING_PATTERN,
  DOTS_AT_END_PATTERN,
  NAME_ALLOWED_CHARACTERS_PATTERN,
  NUMBERS_AT_BEGINNING_PATTERN,
  ParsedConfigVariable,
  PropertyType,
  Visibility,
  VisibilityQuery,
} from '@poly/model';

const JSON_META_SCHEMA_CACHE = {};

@Injectable()
export class CommonService {
  private readonly logger = new Logger(CommonService.name);

  constructor(
    private readonly config: ConfigService,
  ) {
  }

  async getJsonSchema(typeName: string, content: any): Promise<Record<string, any> | null> {
    if (!content) {
      return null;
    }

    const jsonInput = jsonInputForTargetLanguage('json-schema');
    await jsonInput.addSource({
      name: typeName,
      samples: [typeof content === 'string' ? content : JSON.stringify(content)],
    });
    const inputData = new InputData();
    inputData.addInput(jsonInput);

    const { lines } = await quicktype({
      lang: 'json-schema',
      inputData,
      indentation: '  ',
    });
    const schema = JSON.parse(lines.join('\n'));

    if (schema.$ref) {
      // fix root $ref
      Object.assign(
        schema,
        schema.definitions[schema.$ref.replace('#/definitions/', '')],
      );
      delete schema.definitions[schema.$ref.replace('#/definitions/', '')];
      delete schema.$ref;
    }

    return schema;
  }

  getPathContent(content: any, path: string | null): any {
    if (!path) {
      return content;
    }

    try {
      const result = jsonpath.query(content, path);
      if (path.includes('[*]')) {
        return result;
      } else if (result.length === 0) {
        return null;
      } else {
        return result[0];
      }
    } catch (e) {
      throw new PathError(path);
    }
  }

  async resolveType(typeName: string, value: any, subpath?: string): Promise<[string, Record<string, any>?, Record<string, string>?]> {
    const numberRegex = /^-?\d+\.?\d*$/;
    const booleanRegex = /^(true|false)$/;

    if (numberRegex.test(value)) {
      return ['number'];
    }
    if (booleanRegex.test(value)) {
      return ['boolean'];
    }
    try {
      const isStringValue = typeof value === 'string';
      let obj = isStringValue ? JSON.parse(this.filterJSONComments(value)) : value;
      if (obj && typeof obj === 'object') {
        if (subpath) {
          obj = this.getPathContent(obj, subpath);
        }

        const typeSchema = await this.getJsonSchema(typeName, obj);
        if (typeSchema) {
          return ['object', isStringValue ? this.enhanceJSONSchemaWithComments(typeSchema, value, subpath) : typeSchema];
        } else {
          return ['object'];
        }
      }
    } catch (e) {
      // not json
    }

    return ['string'];
  }

  async toPropertyType(name: string, type: ArgumentType, typeObject?: object, typeSchema?: Record<string, any>): Promise<PropertyType> {
    if (typeSchema) {
      return {
        kind: 'object',
        schema: typeSchema,
      };
    }

    if (type.endsWith('[]')) {
      return {
        kind: 'array',
        items: await this.toPropertyType(name, type.substring(0, type.length - 2)),
      };
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
          const schema = await this.getJsonSchema(toPascalCase(name), typeObject);
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

  trimDownObject(obj: any, maxArrayItems = 1): any {
    if (typeof obj !== 'object') {
      return obj;
    }

    const trimDownArray = (array: any[]) => array.slice(0, maxArrayItems).map((item: any) => this.trimDownObject(item, maxArrayItems));

    if (Array.isArray(obj)) {
      return trimDownArray(obj);
    }

    const newObj = {};
    for (const key in obj) {
      if (Array.isArray(obj[key])) {
        newObj[key] = trimDownArray(obj[key]);
      } else {
        newObj[key] = this.trimDownObject(obj[key], maxArrayItems);
      }
    }
    return newObj;
  }

  sanitizeContextIdentifier(context: string) {
    return context.trim()
      .replace(CONTEXT_ALLOWED_CHARACTERS_PATTERN, '')
      .replace(NUMBERS_AT_BEGINNING_PATTERN, '')
      .replace(DOTS_AT_BEGINNING_PATTERN, '')
      .replace(DOTS_AT_END_PATTERN, '');
  }

  sanitizeNameIdentifier(name: string) {
    return name.trim().replace(NAME_ALLOWED_CHARACTERS_PATTERN, '').replace(NUMBERS_AT_BEGINNING_PATTERN, '');
  }

  getVisibilityFilterCondition({ includePublic, tenantId }: VisibilityQuery) {
    return {
      OR: [
        includePublic
          ? {
              AND: [
                { visibility: Visibility.Public },
                {
                  environment: {
                    tenant: {
                      publicVisibilityAllowed: true,
                    },
                  },
                },
              ],
            }
          : {},
        tenantId
          ? {
              AND: [
                { visibility: Visibility.Tenant },
                {
                  environment: {
                    tenant: {
                      id: tenantId,
                    },
                  },
                },
              ],
            }
          : {},
      ],
    };
  }

  getConfigVariableWithParsedValue<T = any>(configVariable: ConfigVariable): ParsedConfigVariable<T> {
    return {
      ...configVariable,
      value: JSON.parse(configVariable.value),
    };
  }

  getContextsNamesIdsFilterConditions(contexts?: string[], names?: string[], ids?: string[]) {
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

    const idConditions = [ids?.length ? { id: { in: ids } } : undefined].filter(Boolean) as any;

    const filterConditions = [
      {
        OR: contextConditions,
      },
      names?.length ? { name: { in: names } } : undefined,
    ].filter(Boolean) as any[];

    return [{ AND: filterConditions }, ...idConditions];
  }

  getConfigVariableFilters(name: string | null, tenantId: string | null = null, environmentId: string | null = null) {
    const OR: [{ name?: string, tenantId: string | null, environmentId?: string | null }] = [
      {
        ...(name ? { name } : {}),
        tenantId: null,
        environmentId: null,
      },
    ];

    if (tenantId) {
      OR.push({
        ...(name ? { name } : {}),
        tenantId,
        environmentId: null,
      });
    }
    if (environmentId) {
      OR.push({
        ...(name ? { name } : {}),
        tenantId,
        environmentId,
      });
    }

    return {
      OR,
    };
  }

  isPrismaUniqueConstraintFailedError(error: unknown, field?: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2002' && Array.isArray(error.meta?.target) && !!field && (error.meta?.target || '').includes(field);
    }
    return false;
  }

  getPublicContext(entity: { context: string | null, environment: { tenant: Tenant }}) {
    const { context, environment: { tenant } } = entity;
    return `${tenant.publicNamespace ? `${tenant.publicNamespace}${context ? '.' : ''}` : ''}${context || ''}`;
  }

  isPublicVisibilityAllowed(
    entity: { context: string | null, environment: { tenant: Tenant }},
    defaultHidden: boolean,
    visibleContexts: string[] | null,
  ): boolean {
    if (!defaultHidden || !visibleContexts) {
      return true;
    }
    const publicContext = `${this.getPublicContext(entity)}.`;
    return visibleContexts.some(visibleContext => publicContext.startsWith(`${visibleContext}.`));
  }

  async validateJsonMetaSchema(schema: Record<string, any>): Promise<boolean> {
    try {
      const getMetaSchema = async () => {
        const metaSchemaUrl = schema.$schema || 'http://json-schema.org/draft-06/schema#';
        if (JSON_META_SCHEMA_CACHE[metaSchemaUrl]) {
          return JSON_META_SCHEMA_CACHE[metaSchemaUrl];
        }
        const response = await axios.get(metaSchemaUrl);
        JSON_META_SCHEMA_CACHE[metaSchemaUrl] = response.data;
        return response.data;
      };

      const metaSchema = await getMetaSchema();
      const validate = validator(metaSchema);
      return validate(schema);
    } catch (e) {
      this.logger.debug(`Failed to validate JSON meta schema: ${e.message}`);
      return false;
    }
  }

  checkVisibilityAllowed(tenant: Tenant, visibility: Visibility | null | undefined) {
    if (tenant.name === null && visibility === Visibility.Public) {
      throw new BadRequestException(`Cannot set ${Visibility.Public} if tenant does not have a name.`);
    }
  }

  filterJSONComments(jsonString: string) {
    try {
      return stringify(parse(jsonString, undefined, true));
    } catch (e) {
      // error while parsing json, return original string
      return jsonString;
    }
  }

  private enhanceJSONSchemaWithComments(typeSchema: Record<string, any>, jsoncString: string, subpath?: string): Record<string, any> {
    const comments = this.extractComments(jsoncString, subpath);

    const processObject = (obj: any, currentPath = '') => {
      if (obj.$ref) {
        processObject(_.get(typeSchema, obj.$ref.replace('#/', '').replace('/', '.')), currentPath);
        return;
      }

      if (comments[currentPath]) {
        obj.description = comments[currentPath];
      }

      if (obj.type === 'object' && obj.properties) {
        Object.keys(obj.properties).forEach((key) => {
          const propertyPath = currentPath ? `${currentPath}.${key}` : key;

          processObject(obj.properties[key], propertyPath);
        });
      } else if (obj.type === 'array' && obj.items) {
        processObject(obj.items, `${currentPath}.[]`);
      }
    };

    processObject(typeSchema);

    return typeSchema;
  }

  private extractComments(jsoncString: string, subpath?: string): Record<string, string> {
    const propComments = {};
    const parsed = parse(jsoncString, undefined);

    const commentsToString = (comments: CommentToken[] | undefined) => comments
      ?.map((comment) => comment.value.trim())
      ?.join('\n');

    const processObject = (obj: any, currentPath = '') => {
      Object.keys(obj).forEach((key) => {
        const commentSymbols = [
          `before:${key}`,
          `after-prop:${key}`,
          `after-colon:${key}`,
          `after-value:${key}`,
          `after:${key}`,
        ];
        const propertyPath = currentPath ? `${currentPath}.${Array.isArray(obj) ? '[]' : key}` : key;
        if (subpath && !propertyPath.startsWith(subpath)) {
          return;
        }
        const propertyComments = commentSymbols
          .map(symbol => commentsToString(obj[Symbol.for(symbol)]))
          .filter(Boolean)
          .join('\n');

        if (propertyComments) {
          let path = subpath ? propertyPath.substring(subpath.length) : propertyPath;
          if (path.startsWith('.')) {
            path = path.substring(1);
          }
          propComments[path] = [propComments[path]].filter(Boolean)
            .concat(propertyComments)
            .join('\n');
        }

        if (obj[key] && typeof obj[key] === 'object') {
          processObject(obj[key], propertyPath);
        }
      });
    };

    processObject(parsed);

    return propComments;
  }

  getHostUrlWithSubdomain(environment: Environment) {
    const hostUrl = this.config.hostUrl;
    const urlParts = hostUrl.split('://');
    return `${urlParts[0]}://${environment.subdomain}.${urlParts[1]}`;
  }
}
