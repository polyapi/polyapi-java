import { Injectable, Logger as NestLogger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { DbLogger } from 'logger/db-logger';
import { Cron } from '@nestjs/schedule';
import { Log } from '@prisma/client';
import { ConfigVariableName, LogDto } from '@poly/model';
import { ConfigVariableService } from 'config-variable/config-variable.service';

@Injectable()
export class LoggerService {
  private readonly logger = new NestLogger(LoggerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configVariableService: ConfigVariableService,
  ) {
  }

  @Cron('0 0 0 * * *')
  async deleteOldLogs() {
    this.logger.debug('Clearing old logs...');

    const logRetentionDays = await this.configVariableService.getEffectiveValue<number>(ConfigVariableName.LogRetentionDays) || 30;
    this.prisma.log.deleteMany({
      where: {
        createdAt: {
          lt: new Date(new Date().getTime() - logRetentionDays * 24 * 60 * 60 * 1000),
        },
      },
    });
  }

  toDto(log: Log): LogDto {
    return {
      id: log.id,
      level: log.level,
      context: log.context,
      message: JSON.parse(log.message),
      date: log.createdAt,
      entityType: log.entityType,
      entityId: log.entityId,
    };
  }

  createLogger(context: string): DbLogger {
    return new DbLogger(context, this.prisma);
  }

  async getLogs(
    level: string | undefined,
    context: string | undefined,
    dateFrom: Date | undefined,
    dateTo: Date | undefined,
    entityType: string | undefined | null,
    entityId: string | undefined | null,
  ) {
    return this.prisma.log.findMany({
      where: {
        level,
        context,
        createdAt: {
          gte: dateFrom || undefined,
          lte: dateTo || undefined,
        },
        entityType,
        entityId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findLog(id: string) {
    return this.prisma.log.findUnique({
      where: {
        id,
      },
    });
  }

  async deleteLog(log: Log) {
    return this.prisma.log.delete({
      where: {
        id: log.id,
      },
    });
  }
}
