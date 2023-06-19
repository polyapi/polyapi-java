import { Injectable } from '@nestjs/common';
import { InputData, jsonInputForTargetLanguage, quicktype } from 'quicktype-core';
import jsonpath from 'jsonpath';
import { PathError } from './path-error';

import {
  NAME_ALLOWED_CHARACTERS_PATTERN,
  CONTEXT_ALLOWED_CHARACTERS_PATTERN,
  DOTS_AT_BEGINNING_PATTERN,
  DOTS_AT_END_PATTERN,
  NUMBERS_AT_BEGINNING_PATTERN, Visibility,
} from '@poly/model';

@Injectable()
export class CommonService {
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

  async generateTypeDeclaration(typeName: string, content: any, namespace: string) {
    const wrapToNamespace = (code: string) => `namespace ${namespace} {\n  ${code}\n}`;

    if (!content) {
      return wrapToNamespace(`type ${typeName} = any;`);
    }

    const name = 'TemporaryUniqueHardToGuessType';
    const jsonInput = jsonInputForTargetLanguage('ts');
    await jsonInput.addSource({
      name,
      samples: [
        JSON.stringify({
          content,
        }),
      ],
    });
    const inputData = new InputData();
    inputData.addInput(jsonInput);

    const { lines } = await quicktype({
      lang: 'ts',
      inputData,
      combineClasses: true,
      indentation: '  ',
      rendererOptions: {
        'just-types': 'true',
      },
    });

    const temporaryTypeRegex = new RegExp(`interface ${name}\\s*\{\\s*content: (\\S+);\\s*\}\\s*`, 'g');
    let typeDeclaration = lines
      .map(line => line.replaceAll('export interface', 'interface'))
      .map(line => line.replace('interface Content', `interface ${typeName}`))
      .join('\n');

    const match = temporaryTypeRegex.exec(typeDeclaration);
    if (match) {
      const [temporaryType, type] = match;
      if (type === 'Content') {
        typeDeclaration = typeDeclaration.replace(temporaryType, '');
      } else {
        typeDeclaration = typeDeclaration.replace(temporaryType, `type ${typeName} = ${type};`);
      }
    }

    return wrapToNamespace(typeDeclaration);
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
      const obj = JSON.parse(value);
      if (obj && typeof obj === 'object') {
        const type = await this.getJsonSchema(typeName, obj);
        return ['object', type || undefined];
      }
    } catch (e) {
      // not json
    }

    return ['string'];
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

  getPublicVisibilityFilterCondition() {
    return {
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
    };
  }
}
