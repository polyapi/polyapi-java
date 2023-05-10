export class AuthProviderDto {
  id: string;
  name: string | null;
  context: string;
  authorizeUrl: string;
  tokenUrl: string;
  audienceRequired: boolean;
  refreshEnabled: boolean;
  revokeUrl: string | null;
  introspectUrl: string | null;
  callbackUrl: string;
}
