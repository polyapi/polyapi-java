import { Injectable, Logger } from '@nestjs/common';
import { InputData, jsonInputForTargetLanguage, quicktype } from 'quicktype-core';
import jsonpath from 'jsonpath';
import { PathError } from './path-error';

import {
  NAME_ALLOWED_CHARACTERS_PATTERN,
  CONTEXT_ALLOWED_CHARACTERS_PATTERN,
  DOTS_AT_BEGINNING_PATTERN,
  DOTS_AT_END_PATTERN,
  NUMBERS_AT_BEGINNING_PATTERN, Visibility, ArgumentType, PropertyType, ParsedConfigVariable, VisibilityQuery,
} from '@poly/model';
import { toPascalCase } from '@guanghechen/helper-string';
import { ConfigVariable } from '@prisma/client';

const ARGUMENT_TYPE_SUFFIX = '.Argument';

@Injectable()
export class CommonService {
  private readonly logger = new Logger(CommonService.name);

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

  async resolveType(typeName: string, value: any): Promise<[string, Record<string, any>?]> {
    const numberRegex = /^-?\d+\.?\d*$/;
    const booleanRegex = /^(true|false)$/;

    if (numberRegex.test(value)) {
      return ['number'];
    }
    if (booleanRegex.test(value)) {
      return ['boolean'];
    }
    try {
      const obj = typeof value === 'string' ? JSON.parse(value) : value;
      if (obj && typeof obj === 'object') {
        const type = await this.getJsonSchema(typeName, obj);
        return ['object', type || undefined];
      }
    } catch (e) {
      // not json
    }

    return ['string'];
  }

  async toPropertyType(name: string, type: ArgumentType, typeObject?: object, typeSchema?: Record<string, any>): Promise<PropertyType> {
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
        if (typeSchema) {
          return {
            kind: 'object',
            schema: typeSchema,
          };
        } else if (typeObject) {
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
}
