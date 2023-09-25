import { IsString, IsIn, ValidateIf, IsOptional, ValidateNested, IsArray, ArrayMaxSize, arrayMinSize, ArrayMinSize, ArrayUnique, IsObject, ArrayContains } from 'class-validator';
import { Type } from 'class-transformer';
import { Record } from '../../validators';
import { HTTP_METHODS  } from '../../utils'

class UpdateSourceEntry { 
    @IsString()
    key: string;
  
    @IsString()
    value: string;
}

export class UpdateSourceNullableEntry {
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
  
export class UpdateAuth {
    @IsString()
    @IsIn(['basic', 'bearer', 'apiKey'])
    type: 'basic' | 'bearer' | 'apiKey'
  }

class BasicAuthEntries {
    
    @IsString()
    @IsIn(['username', 'password'])
    key: 'username' | 'password';

    @IsString()
    value: string;
}

class BasicAuth extends UpdateAuth {
    @IsString()
    type: 'basic';

    @IsArray()
    @ValidateNested({ each: true })
    @ArrayMaxSize(2)
    @ArrayMinSize(2)
    @Type(() => BasicAuthEntries)
    @ArrayUnique(o => o.key)
    basic: BasicAuthEntries[]
}

class ApiKeyAuth extends UpdateAuth{
    @IsString()
    type: 'apiKey';

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateSourceEntry)
    @ArrayUnique(o => o.key)
    @ArrayMinSize(2)
    apiKey: UpdateSourceEntry[]
  }

class BearerAuth extends UpdateAuth {
    @IsString()
    type: 'bearer'
    
    @IsString()
    bearer: string;
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
    
    @IsObject()
    @IsOptional()
    @ValidateNested()
    @Type(() => UpdateAuth, {
        keepDiscriminatorProperty: true,
        discriminator: {
            property: 'type',
            subTypes: [{
                value: BasicAuth,
                name: 'basic'
            },{
                value: BearerAuth,
                name: 'bearer'
            }, {
                value: ApiKeyAuth,
                name: 'apiKey'
            }]
        }
    })
    auth?: BasicAuth | BearerAuth | ApiKeyAuth;
    
    @IsObject()
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