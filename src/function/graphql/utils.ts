import { Kind, TypeNode, VariableDefinitionNode, isExecutableDefinitionNode, parse, IntrospectionQuery } from 'graphql';
import { GraphQLJSONSchema6, fromIntrospectionQuery } from 'graphql-2-json-schema';
import { JSONSchema6Acc } from 'graphql-2-json-schema/dist/lib/reducer';
import { cloneDeep } from 'lodash';

export type IntrospectionJsonSchema = ReturnType<typeof fromIntrospectionQuery>

export const getGraphqlQueryName = (query: string) => {
  const document = parse(query);

  let queryName = '';
  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION && definition.name?.value) {
      queryName = definition.name.value;
      break;
    }
  }

  return queryName;
};

export const getGraphqlVariables = (query: string) => {
  const variables: VariableDefinitionNode[] = [];

  const document = parse(query);

  for (const definition of document.definitions) {
    if ('variableDefinitions' in definition) {
      for (const variableDefinition of (definition.variableDefinitions || [])) {
        variables.push(variableDefinition);
      }
    }
  }

  return variables;
};

export const getGraphqlIdentifier = (query: string): string => {
  let identifier = '';

  const document = parse(query);

  for (const definition of document.definitions) {
    if (isExecutableDefinitionNode(definition)) {
      for (const selection of definition.selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
          const alias = selection.alias?.value ? `${selection.alias?.value}-` : '';

          identifier += `${identifier.length ? ',' : ''}${alias}${selection.name.value}`;
        }
      }
      break;
    }
  }

  return identifier.split(',').sort((a, b) => {
    if (a < b) {
      return -1;
    }

    if (a > b) {
      return 1;
    }

    return 0;
  }).join(',');
};

const getArrayOfType = (type: Record<string, any>, requiredItems: boolean) => ({
  type: 'array',
  items: {
    ...(!requiredItems
      ? {
          anyOf: [
            type,
            {
              type: 'null',
            },
          ],
        }
      : type),
  },
});

const getType = ($schema: 'string', required: boolean, isList: boolean, requiredListItems: boolean, type: Record<string, any>, definitions?: any[]) => {
  const finalType = '$ref' in type ? { $ref: type.$ref } : type;
  return {
    required,
    type: 'object',
    typeSchema: {
      $schema,
      anyOf: [
        !required
          ? {
              type: 'null',
            }
          : null,
        isList ? getArrayOfType(finalType, requiredListItems) : finalType,
      ].filter(Boolean),
      ...(definitions ? { definitions } : {}),
    },
  };
};

export const getJsonSchemaFromIntrospectionQuery = (introspection: IntrospectionQuery) => fromIntrospectionQuery(introspection, {
  nullableArrayItems: true,
});

export const resolveGraphqlArgumentType = (typeNode: TypeNode, introspectionJsonSchema: IntrospectionJsonSchema, isList = false, required = false, requiredListItems = false): {
  required: boolean,
  type: string,
  typeSchema?: Record<string, any>
} => {
  const introspectionJsonSchemaCopy = cloneDeep(introspectionJsonSchema) as any;

  const $schema = introspectionJsonSchemaCopy.$schema;

  if ('type' in typeNode) {
    if (typeNode.kind === Kind.NON_NULL_TYPE) {
      if (isList) {
        return resolveGraphqlArgumentType(typeNode.type, introspectionJsonSchemaCopy, isList, required, true);
      } else {
        return resolveGraphqlArgumentType(typeNode.type, introspectionJsonSchemaCopy, isList, true, requiredListItems);
      }
    }

    if (typeNode.kind === Kind.LIST_TYPE) {
      return resolveGraphqlArgumentType(typeNode.type, introspectionJsonSchemaCopy, true, required, requiredListItems);
    }
  } else if (['Float', 'Int', 'String', 'Boolean', 'ID'].includes(typeNode.name.value)) {
  // Here we check only default scalar types, see: https://graphql.org/learn/schema/#scalar-types

    const namedType = typeNode.name.value;

    let scalarType = 'string';

    // CheckDefault scalar types first.
    if (['Float', 'Int'].includes(namedType)) {
      scalarType = 'number';
    } if (namedType === 'String') {
      scalarType = 'string';
    } else if (namedType === 'Boolean') {
      scalarType = 'boolean';
    } else if (namedType === 'ID') {
      return getType($schema, required, isList, requiredListItems, {
        anyOf: [
          {
            type: 'string',
          },
          {
            type: 'number',
          },
        ],
      });
    }

    return getType($schema, required, isList, requiredListItems, { type: scalarType });
  }

  // Here we evaluate custom scalar types.

  const namedType = typeNode.name.value;

  if (typeof introspectionJsonSchemaCopy === 'boolean' || !introspectionJsonSchemaCopy.definitions || (!(namedType in introspectionJsonSchemaCopy.definitions))) {
    throw new Error(`Couldn't parse graphql named type: ${namedType}`);
  }

  const typeDefinition = introspectionJsonSchemaCopy.definitions[namedType] as GraphQLJSONSchema6;

  const customScalarType: typeof introspectionJsonSchema['type'] = ['number', 'string', 'boolean', 'object', 'array'];

  /*
    Custom scalar type, should be set as `customScalarType`, since we can't guess what is the desired type on server side.
    See graphql docs: https://graphql.org/learn/schema/#scalar-types
    `graphql-2-json-schema` lib show us custom scalar types as `type: 'object'` without properties object.
  */
  if (typeDefinition.type === 'object' && typeof typeDefinition.properties === 'undefined') {
    return getType($schema, required, isList, requiredListItems, customScalarType);
  }

  // A compound type can have a custom scalar types inside, so we have to convert them to `typeDefinition` too.
  const definitions = introspectionJsonSchemaCopy.definitions as JSONSchema6Acc;

  for (const [name, value] of Object.entries(definitions)) {
    if (value.type === 'object' && typeof value.properties === 'undefined') {
      definitions[name].type = customScalarType;
    }

    if (name === 'ID') {
      definitions[name].type = ['number', 'string'];
    }
  }

  // We need to apply `anyOf` with `null` as option to keys that are not required.
  for (const definition of Object.values(definitions)) {
    const requiredProperties = definition.required || [];

    if (definition.type === 'object' && definition.properties) {
      for (const [property, value] of Object.entries(definition.properties)) {
        const isRequired = requiredProperties.find(required => required === property);

        if (!isRequired) {
          definition.properties[property] = {
            anyOf: [
              {
                type: 'null',
              },
              value,
            ],
          };
        }
      }
    }
  }

  // Compound objects defined in graphql api type system.
  return getType($schema, required, isList, requiredListItems, { $ref: `#/definitions/${namedType}` }, introspectionJsonSchemaCopy.definitions);
};
