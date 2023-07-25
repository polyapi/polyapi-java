export interface ErrorHandlerDto {
  id?: string;
  path: string;
  apiKey: string;
  applicationIds?: string[];
  environmentIds?: string[];
  functionIds?: string[];
  tenant?: boolean;
}
