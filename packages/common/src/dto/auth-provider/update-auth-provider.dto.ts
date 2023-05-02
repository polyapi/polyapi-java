import { IsOptional, IsUrl } from 'class-validator';

export class UpdateAuthProviderDto {
  context?: string;
  @IsUrl({
    require_protocol: true,
  })
  @IsOptional()
  authorizeUrl?: string;
  @IsUrl({
    require_protocol: true,
  })
  @IsOptional()
  tokenUrl?: string;
  audienceRequired?: boolean;
  refreshEnabled?: boolean;
  @IsUrl({
    require_protocol: true,
  })
  @IsOptional()
  revokeUrl?: string | null;
  @IsUrl({
    require_protocol: true,
  })
  @IsOptional()
  introspectUrl?: string | null;
}
