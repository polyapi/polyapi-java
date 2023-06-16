export interface ExecuteAuthProviderDto {
  eventsClientId: string;
  clientId: string;
  clientSecret: string;
  audience?: string;
  scopes?: string[];
  callbackUrl?: string;
}

export interface ExecuteAuthProviderResponseDto {
  url?: string;
  token?: string;
}
