export interface TeachResponseDto {
  functionId: string;
  variables?: {
    [key: string]: string;
  };
}
