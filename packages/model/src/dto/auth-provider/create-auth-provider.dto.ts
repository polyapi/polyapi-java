import { IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class CreateAuthProviderDto {
  @IsOptional()
  name?: string;

  @IsNotEmpty()
  context: string;

  @IsNotEmpty()
  @IsUrl({
    require_protocol: true,
  })
  authorizeUrl: string;

  @IsNotEmpty()
  @IsUrl({
    require_protocol: true,
  })
  tokenUrl: string;

  audienceRequired?: boolean;
  refreshEnabled?: boolean;
  @IsUrl({
    require_protocol: true,
  })
  @IsOptional()
  revokeUrl?: string;

  @IsUrl({
    require_protocol: true,
  })
  @IsOptional()
  introspectUrl?: string;
}
