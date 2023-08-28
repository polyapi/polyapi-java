import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class TosService {
  private readonly logger = new Logger(TosService.name);
  constructor(
        private readonly prisma: PrismaService,
  ) {}

  async create(content: string, version: string) {
    try {
      return await this.prisma.tos.create({
        data: {
          content,
          version,
        },
      });
    } catch (err) {
      if (err.code === 'P2002' && Array.isArray(err.meta.target) && err.meta.target.includes('version')) {
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

    if (!tos) {
      throw new NotFoundException('Tos version not found.');
    }

    return tos;
  }
}
