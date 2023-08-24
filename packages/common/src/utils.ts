import type { PropertySpecification, PropertyType } from '@poly/model';

export const INSTANCE_URL_MAP = {
  'develop': 'develop-k8s.polyapi.io',
  'na1': 'na1.polyapi.io',
  'local': 'localhost:8000'
};

export const getInstanceUrl = (instance = 'local') => {
  let protocol = instance === 'local' ? 'http://' : 'https://';
  let instanceUrl = INSTANCE_URL_MAP[instance];

  if(typeof INSTANCE_URL_MAP[instance] === 'undefined') {
    protocol = 'http://';
    instanceUrl = INSTANCE_URL_MAP.local;
  }

  return `${protocol}${instanceUrl}`;
}

export const isPlainObjectPredicate = (value: unknown): value is object => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const toTypeDeclaration = (type: PropertyType, synchronous = true) => {
  const wrapInPromiseIfNeeded = (code: string) => (synchronous ? code : `Promise<${code}>`);

  switch (type.kind) {
    case 'plain':
      return type.value;
    case 'primitive':
      return wrapInPromiseIfNeeded(type.type);
    case 'void':
      return wrapInPromiseIfNeeded('void');
    case 'array':
      return wrapInPromiseIfNeeded(`${toTypeDeclaration(type.items)}[]`);
    case 'object':
      if (type.typeName) {
        return wrapInPromiseIfNeeded(type.typeName);
      } else if (type.properties) {
        return wrapInPromiseIfNeeded(
          `{ ${type.properties
            .map((prop) => `'${prop.name}'${prop.required === false ? '?' : ''}: ${toTypeDeclaration(prop.type)}`)
            .join(';\n')} }`,
        );
      } else {
        return wrapInPromiseIfNeeded('any');
      }
    case 'function': {
      if (type.name) {
        return type.name;
      }
      const toArgument = (arg: PropertySpecification) =>
        `${arg.name}${arg.required === false ? '?' : ''}: ${toTypeDeclaration(arg.type)}${
          arg.nullable === true ? ' | null' : ''
        }`;

      return `(${type.spec.arguments.map(toArgument).join(', ')}) => ${toTypeDeclaration(
        type.spec.returnType,
        type.spec.synchronous === true,
      )}`;
    }
  }
};
