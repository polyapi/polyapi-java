import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CommonService } from 'common/common.service';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class TosService {
  private readonly logger = new Logger(TosService.name);
  constructor(
        private readonly prisma: PrismaService,
        private readonly commonService: CommonService,
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

  async findOne(id?: string) {
    const tos = await this.prisma.tos.findFirst({
      where: {
        ...(id ? { id } : {}),
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
      ],
    });

    return tos;
  }
}
