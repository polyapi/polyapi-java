import { ValueType } from './dto/variable';

export type SpecificationType =
  'apiFunction'
  | 'customFunction'
  | 'authFunction'
  | 'webhookHandle'
  | 'serverFunction'
  | 'serverVariable';

interface ISpecification {
  id: string;
  context: string;
  name: string;
  description?: string;
  type: SpecificationType;
  visibilityMetadata: VisibilityMetadata;
}

export enum Visibility {
  Environment = 'ENVIRONMENT',
  Tenant = 'TENANT',
  Public = 'PUBLIC'
}

export interface VisibilityMetadata {
  visibility: Visibility;
  foreignTenantName?: string | null;
}

export interface VisibilityQuery {
  includePublic: boolean;
  tenantId?: string | null;
}

export interface FunctionSpecification {
  arguments: PropertySpecification[];
  returnType: PropertyType;
  synchronous?: boolean;
}

export interface PropertySpecification {
  name: string;
  description?: string;
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
  function: FunctionSpecification;
  apiType: 'graphql' | 'rest'
}

export interface CustomFunctionSpecification extends ISpecification {
  type: 'customFunction';
  function: FunctionSpecification;
  requirements: string[];
  code: string;
}

export interface ServerFunctionSpecification extends ISpecification {
  type: 'serverFunction';
  function: FunctionSpecification;
  code: string;
}

export interface AuthFunctionSpecification extends ISpecification {
  type: 'authFunction';
  function: FunctionSpecification;
  subResource?: string;
}

export interface WebhookHandleSpecification extends ISpecification {
  type: 'webhookHandle';
  function: FunctionSpecification;
}

export interface ServerVariableSpecification extends ISpecification {
  type: 'serverVariable';
  variable: VariableSpecification;
}

export interface VariableSpecification {
  environmentId: string;
  secret: boolean;
  valueType: PropertyType;
  value?: ValueType;
}

export type Specification =
  ApiFunctionSpecification
  | CustomFunctionSpecification
  | ServerFunctionSpecification
  | AuthFunctionSpecification
  | WebhookHandleSpecification
  | ServerVariableSpecification;

export type SpecificationWithFunction = Specification & { function: FunctionSpecification };

export type SpecificationWithVariable = Specification & { variable: VariableSpecification };

export interface SpecificationPath {
  id: string;
  path: string;
}
