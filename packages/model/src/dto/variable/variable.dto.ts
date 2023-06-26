import { Visibility } from '../../specs';

export type ValueType = string | number | boolean | object | null;

export interface VariableDto {
  id: string;
  context: string;
  name: string;
  description: string;
  visibility: Visibility;
  secret: boolean;
  value?: ValueType;
}
