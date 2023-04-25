interface ISpecification {
  id: string;
  context: string;
  name: string;
  description?: string;
  function: FunctionSpecification;
  type: SpecificationType;
}

export type SpecificationType = 'apiFunction' | 'customFunction' | 'authFunction' | 'webhookHandle' | 'serverFunction';

export enum FunctionVisibility {
  Tenant = 'TENANT',
  Team = 'TEAM',
  User = 'USER',
  Public = 'PUBLIC'
}

export interface FunctionSpecification {
  arguments: PropertySpecification[];
  returnType: PropertyType;
  synchronous?: boolean;
}

export interface PropertySpecification {
  name: string;
  type: PropertyType;
  required: boolean;
  nullable?: boolean;
}

interface IPropertyType {
  kind: 'void' | 'primitive' | 'array' | 'object' | 'function' | 'plain';
}

export type PropertyType =
  VoidPropertyType
  | PrimitivePropertyType
  | ArrayPropertyType
  | ObjectPropertyType
  | FunctionPropertyType
  | PlainPropertyType;

interface VoidPropertyType extends IPropertyType {
  kind: 'void';
}

interface PrimitivePropertyType extends IPropertyType {
  kind: 'primitive';
  type: 'string' | 'number' | 'boolean';
}

export interface ArrayPropertyType extends IPropertyType {
  kind: 'array';
  items: PropertyType;
}

export interface ObjectPropertyType extends IPropertyType {
  kind: 'object';
  schema?: Record<string, any>;
  properties?: PropertySpecification[];
  typeName?: string;
}

export interface FunctionPropertyType extends IPropertyType {
  kind: 'function';
  name?: string;
  spec: FunctionSpecification;
}

export interface PlainPropertyType extends IPropertyType {
  kind: 'plain';
  value: string;
}

export interface ApiFunctionSpecification extends ISpecification {
  type: 'apiFunction';
}

export interface CustomFunctionSpecification extends ISpecification {
  type: 'customFunction';
  code: string;
}

export interface ServerFunctionSpecification extends ISpecification {
  type: 'serverFunction';
  code: string;
}

export interface AuthFunctionSpecification extends ISpecification {
  type: 'authFunction';
  subResource?: string;
}

export interface WebhookHandleSpecification extends ISpecification {
  type: 'webhookHandle';
}

export type Specification =
  ApiFunctionSpecification
  | CustomFunctionSpecification
  | ServerFunctionSpecification
  | AuthFunctionSpecification
  | WebhookHandleSpecification;

export interface SpecificationPath {
  id: string;
  path: string;
}
