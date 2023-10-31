import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'prisma-module/prisma.service';
import { FunctionService } from 'function/function.service';
import { MigrationContext } from 'migration/types';
import { AuthService } from 'auth/auth.service';
import { WebhookService } from 'webhook/webhook.service';

import migrations from './migrations/index';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly functionService: FunctionService,
    private readonly authService: AuthService,
    private readonly webhookService: WebhookService,
    // add more services when needed
  ) {
  }

  async onModuleInit() {
    try {
      await this.executeMigrations();
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  async executeMigrations() {
    this.logger.log('Executing migrations...');

    const executedMigrations = await this.prisma.migration.findMany();
    let found = false;
    const migrationContext: MigrationContext = {
      prisma: this.prisma,
      functionService: this.functionService,
      authService: this.authService,
      webhookService: this.webhookService,
      loggerService: this.logger,
    };

    migrations.sort((a, b) => {
      if (a.name < b.name) {
        return -1;
      }

      if (a.name > b.name) {
        return 1;
      }

      return 0;
    });

    await this.prisma.$transaction(async (prisma) => {
      for (const migration of migrations) {
        if (executedMigrations.some(executedMigration => executedMigration.fileName === migration.name)) {
          continue;
        }

        this.logger.log(`Executing migration ${migration.name}...`);
        await migration.run(migrationContext);
        await prisma.migration.create({
          data: {
            fileName: migration.name,
          },
        });
        this.logger.log(`Finished migration ${migration.name} successfully`);
        found = true;
      }
    }, {
      timeout: 60_000,
    });

    if (!found) {
      this.logger.log('No new migrations found');
    }
  }
}
