import { IsNotEmpty } from 'class-validator';

export class CreatePluginDto {
  @IsNotEmpty()
  slug: string;
  name?: string;
  iconUrl?: string;
  descriptionForMarketplace?: string;
  descriptionForModel?: string;
  functionIds?: string[];
}
