import { Visibility } from '../../specs';

export type ValueType = string | number | boolean | object | null | any[];

export interface VariableDto {
  id: string;
  context: string;
  name: string;
  description: string;
  visibility: Visibility;
  secret: boolean;
  value?: ValueType;
}

export interface VariablePublicDto extends VariableDto {
  tenant: string;
  hidden: boolean;
}
