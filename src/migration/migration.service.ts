import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { FunctionService } from 'function/function.service';
import { MigrationContext } from 'migration/types';
import { AuthService } from 'auth/auth.service';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly functionService: FunctionService,
    private readonly authService: AuthService,
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
    const migrationFiles = fs.readdirSync(path.join(__dirname, 'migrations'))
      .filter(file => file.endsWith('.js'))
      .map(file => file.replace('.js', ''));
    const executedMigrations = await this.prisma.migration.findMany();
    let found = false;

    migrationFiles.sort();

    await this.prisma.$transaction(async (prisma) => {
      for (const file of migrationFiles) {
        if (executedMigrations.some(migration => migration.fileName === file)) {
          continue;
        }

        this.logger.log(`Executing migration ${file}...`);
        const migration = await import(path.join(__dirname, 'migrations', file));
        await migration.run({
          prisma,
          functionService: this.functionService,
          authService: this.authService,
          // add more services when needed
        } as MigrationContext);
        await prisma.migration.create({
          data: {
            fileName: file,
          },
        });
        this.logger.log(`Finished migration ${file} successfully`);
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
