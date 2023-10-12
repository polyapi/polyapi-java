import { Logger as DefaultLogger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
  LOG = 'log',
}

export class DbLogger {
  private readonly logger: DefaultLogger;

  constructor(
    private readonly context: string,
    private readonly prisma: PrismaService,
  ) {
    this.logger = new DefaultLogger(context);
  }

  async error(message: any, entityType?: string, entityId?: string | null, ...optionalParams: any[]) {
    this.logger.error(message, ...optionalParams);
    if (entityType) {
      await this.logToDatabase(LogLevel.ERROR, message, entityType, entityId);
    }
  }

  async log(message: any, entityType?: string, entityId?: string | null, ...optionalParams: any[]) {
    this.logger.log(message, ...optionalParams);
    if (entityType) {
      await this.logToDatabase(LogLevel.LOG, message, entityType, entityId);
    }
  }

  async warn(message: any, entityType?: string, entityId?: string | null, ...optionalParams: any[]) {
    this.logger.warn(message, ...optionalParams);
    if (entityType) {
      await this.logToDatabase(LogLevel.WARN, message, entityType, entityId);
    }
  }

  async debug(message: any, entityType?: string, entityId?: string | null, ...optionalParams: any[]) {
    this.logger.debug(message, ...optionalParams);
    if (entityType) {
      await this.logToDatabase(LogLevel.DEBUG, message, entityType, entityId);
    }
  }

  async verbose(message: any, entityType?: string, entityId?: string | null, ...optionalParams: any[]) {
    this.logger.verbose(message, ...optionalParams);
    if (entityType) {
      await this.logToDatabase(LogLevel.VERBOSE, message, entityType, entityId);
    }
  }

  private async logToDatabase(
    level: LogLevel,
    message: any,
    entityType?: string,
    entityId?: string | null,
  ) {
    try {
      await this.prisma.log.create({
        data: {
          context: this.context,
          message: JSON.stringify(message),
          level,
          entityType,
          entityId,
        },
      });
    } catch (e) {
      this.logger.error('Error writing log to database:', e);
    }
  }
}
