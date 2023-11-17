import type { PropertySpecification, PropertyType } from '@poly/model';

export const INSTANCE_URL_MAP = {
  develop: 'develop-k8s.polyapi.io',
  na1: 'na1.polyapi.io',
  local: 'localhost:8000',
};

export const ASSISTANCE_TRAINING_SCRIPT_VERSION_HEADER = 'x-poly-training-assistant-version';
export const TRAINING_SCRIPT_VERSION_HEADER = 'x-poly-training-script-version';

export const getInstanceUrl = (instance = 'local') => {
  if (typeof INSTANCE_URL_MAP[instance] === 'undefined') {
    return instance;
  }

  let protocol = instance === 'local' ? 'http://' : 'https://';
  let instanceUrl = INSTANCE_URL_MAP[instance];

  if (typeof INSTANCE_URL_MAP[instance] === 'undefined') {
    protocol = 'http://';
    instanceUrl = INSTANCE_URL_MAP.local;
  }

  return `${protocol}${instanceUrl}`;
};

export const isPlainObjectPredicate = (value: unknown): value is object => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

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

export const getStartOfDay = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getEndOfDay = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

export const getOneDayLaterDate = () => {
  const date = new Date();

  date.setHours(date.getHours() + 24);

  return date;
};

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getDateFromNanoseconds = (nanoSecondsTime: bigint): Date => new Date(Number(nanoSecondsTime) / 1000000);

export const getNanosecondsFromDate = (date: Date): string => `${date.getTime() * 1000000}`;

export const getDateMinusXHours = (date: Date, hours: number): Date => {
  date.setHours(date.getHours() - hours);
  return date;
};
