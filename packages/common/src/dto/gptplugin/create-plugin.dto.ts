import { IsNotEmpty } from 'class-validator';

export class CreatePluginDto {
  @IsNotEmpty()
  slug: string;
  name?: string;
  contactEmail?: string;
  legalUrl?: string;
  iconUrl?: string;
  descriptionForMarketplace?: string;
  descriptionForModel?: string;
  functionIds?: string[];
}
