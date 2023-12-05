import { PropertySpecification, PropertyType, Specification } from '@poly/model';
import set from 'lodash/set';

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

export const getContextData = (specs: Specification[]) => {
  const contextData = {} as Record<string, any>;
  specs.forEach((spec) => {
    const path = spec.context ? `${spec.context}.${spec.name}` : spec.name;
    set(contextData, path, spec);
  });
  return contextData;
};
