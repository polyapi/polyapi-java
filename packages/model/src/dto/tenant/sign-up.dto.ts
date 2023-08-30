import { ApiModelProperty } from '@nestjs/swagger/dist/decorators/api-model-property.decorator';

export class SignUpDto {
    @ApiModelProperty({
      nullable: true,
    })
    name: string | null;

    email: string;
    id: string;
}
