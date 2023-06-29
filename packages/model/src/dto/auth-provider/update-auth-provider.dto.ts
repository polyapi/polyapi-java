import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { Visibility } from '../../specs';

export class UpdateAuthProviderDto {
  @IsOptional()
  name?: string;

  @IsOptional()
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

  @IsOptional()
  @IsString()
  @IsEnum(Visibility)
  visibility?: Visibility;
}
