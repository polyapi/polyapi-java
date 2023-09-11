import { ConfigVariableStrategy } from 'config-variable/strategy/base';
import { ConfigVariable } from '@prisma/client';
import { DefaultTosValue } from '@poly/model';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

export class DefaultTosStrategy extends ConfigVariableStrategy<DefaultTosValue> {
  async configure(name: string, value: unknown, tenantId: string | null, environmentId: string | null): Promise<ConfigVariable> {
    if (tenantId !== null || environmentId !== null) {
      throw new ForbiddenException('DefaultTos config variable can only be set at the instance level');
    }

    const { id } = value as DefaultTosValue;

    const tosRecord = await this.prisma.tos.findFirst({
      where: {
        id,
      },
    });

    if (!tosRecord) {
      throw new BadRequestException('Tos record with given id does not exist.');
    }

    const configVariable = await this.prisma.configVariable.findFirst({
      where: {
        name,
        tenantId: null,
        environmentId: null,
      },
    });

    if (configVariable) {
      return this.updateById(configVariable.id, value);
    }

    return this.create({ name, tenantId: null, environmentId: null, value });
  }

  getOneFromList(configVariables: ConfigVariable[]): ConfigVariable | null {
    return configVariables[0];
  }
}
