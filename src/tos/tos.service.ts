import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CommonService } from 'common/common.service';
import { PrismaService } from 'prisma-module/prisma.service';
import { ConfigVariableName, DefaultTosValue } from '../../packages/model/src/dto';
import { ConfigVariableService } from 'config-variable/config-variable.service';

@Injectable()
export class TosService {
  private readonly logger = new Logger(TosService.name);
  constructor(
        private readonly prisma: PrismaService,
        private readonly commonService: CommonService,
        private readonly configVariableService: ConfigVariableService,
  ) {}

  async create(content: string, version: string) {
    try {
      return await this.prisma.tos.create({
        data: {
          content,
          version,
        },
      });
    } catch (error) {
      if (this.commonService.isPrismaUniqueConstraintFailedError(error, 'version')) {
        throw new ConflictException('Tos version already exists.');
      }
    }
  }

  get() {
    return this.prisma.tos.findMany({
      orderBy: [
        {
          createdAt: 'desc',
        },
      ],
    });
  }

  async findTosVersion(version: string) {
    const tos = await this.prisma.tos.findFirst({
      where: {
        version,
      },
    });

    return tos;
  }

  async getDefault() {
    const defaultTosConfigVariable = await this.configVariableService.getEffectiveValue<DefaultTosValue>(ConfigVariableName.DefaultTos, null, null);

    if (!defaultTosConfigVariable) {
      this.logger.debug('No default tos configured.');
      return null;
    }

    return this.prisma.tos.findFirst({
      where: {
        id: defaultTosConfigVariable.id,
      },
    });
  }
}
