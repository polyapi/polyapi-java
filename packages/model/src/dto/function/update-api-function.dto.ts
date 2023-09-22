import { IsString, Validate, IsEnum, IsOptional, ValidateNested, IsIn, IsObject, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { ArgumentsMetadata } from '../../function';
import { ContextIdentifier, NameIdentifier, Record } from '../validators';
import { Visibility } from '../../specs';
import { HTTP_METHODS } from '../utils';

export class UpdateSourceEntry {
  @IsString()
  key: string;

  @ValidateIf((object, value) => value !== null)
  @IsString()
  value: string | null;
}

class Body {
  @IsString()
  @IsIn(['urlencoded', 'formdata', 'raw', 'empty'])
  mode: 'urlencoded' | 'formdata' | 'raw' | 'empty';
}

class EmptyBody extends Body {
  @IsString()
  mode: 'empty';
}

class RawBody extends Body {
  @IsString()
  mode: 'raw';

  @IsString()
  raw: string;
}

class UrlEncodedBody extends Body {
  @IsString()
  mode: 'urlencoded';

  @Record({
    nullable: true,
    type: 'string',
  })
  urlencoded: Record<string, string | null>;
}

class FormDataBody extends Body {
  @IsString()
  mode: 'formdata';

  @Record({
    nullable: true,
    type: 'string',
  })
  formdata: Record<string, string | null>;
}

export class UpdateSourceFunctionDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsIn(HTTP_METHODS)
  method?: string;

  @IsOptional()
  @Record({
    nullable: true,
    type: 'string',
  })
  headers?: Record<string, string | null>;

  @IsOptional()
  @ValidateNested()
  @Type(() => Body, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: 'mode',
      subTypes: [
        {
          value: UrlEncodedBody,
          name: 'urlencoded',
        }, {
          value: FormDataBody,
          name: 'formdata',
        }, {
          value: RawBody,
          name: 'raw',
        }, {
          value: EmptyBody,
          name: 'empty',
        },
      ],
    },
  })
  body?: UrlEncodedBody | FormDataBody | RawBody | EmptyBody;
}

export class UpdateApiFunctionDto {
  @IsOptional()
  @IsString()
  @Validate(NameIdentifier)
  name?: string;

  @IsOptional()
  @IsString()
  @Validate(ContextIdentifier)
  context?: string;

  description?: string;
  arguments?: ArgumentsMetadata;
  response?: any;
  payload?: string;
  @IsOptional()
  @IsString()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateSourceFunctionDto)
  source?: UpdateSourceFunctionDto;
}
