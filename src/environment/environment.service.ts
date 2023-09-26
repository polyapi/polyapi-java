import crypto from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Environment } from '@prisma/client';
import { EnvironmentDto } from '@poly/model';
import { SecretService } from 'secret/secret.service';

@Injectable()
export class EnvironmentService implements OnModuleInit {
  private readonly logger = new Logger(EnvironmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly secretService: SecretService,
  ) {
  }

  async onModuleInit() {
    const environments = await this.prisma.environment.findMany();
    this.logger.debug(`Checking secret service initialization for environments (${environments.length})`);

    try {
      await Promise.all(
        environments.map(async (environment) =>
          await this.secretService.initForEnvironment(environment),
        ),
      );
    } catch (error) {
      this.logger.error(`Error initializing secret service for environments: ${error.message}`);
    }
  }

  toDto(environment: Environment): EnvironmentDto {
    return {
      id: environment.id,
      name: environment.name,
      subdomain: environment.subdomain,
    };
  }

  generateSubdomainID() {
    return crypto.randomBytes(4).toString('hex');
  }

  async getAllByTenant(tenantId: string) {
    return this.prisma.environment.findMany({
      where: {
        tenantId,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.environment.findFirst({
      where: {
        id,
      },
      include: {
        tenant: true,
      },
    });
  }

  async findByHost(host: string) {
    const [subdomain] = host.split('.');
    return this.prisma.environment.findFirst({
      where: {
        subdomain,
      },
      include: {
        tenant: true,
      },
    });
  }

  async create(tenantId: string, name: string) {
    this.logger.log(`Creating environment '${name}' for tenant ${tenantId}`);

    const environment = await this.prisma.environment.create({
      data: {
        name,
        subdomain: this.generateSubdomainID(),
        tenant: {
          connect: {
            id: tenantId,
          },
        },
      },
    });

    await this.secretService.initForEnvironment(environment);

    return environment;
  }

  async update(environment: Environment, name: string) {
    this.logger.log(`Updating environment '${environment.id}'`);

    return this.prisma.environment.update({
      where: {
        id: environment.id,
      },
      data: {
        name,
      },
    });
  }

  async delete(id: string) {
    this.logger.log(`Deleting environment '${id}'`);

    const environment = await this.prisma.environment.delete({
      where: {
        id,
      },
    });

    await this.cleanUp(environment);

    return environment;
  }

  async deleteAllByTenant(tenantId: string) {
    this.logger.log(`Deleting all environments for tenant '${tenantId}'`);

    const environments = await this.getAllByTenant(tenantId);
    await Promise.all(
      environments.map(async (environment) =>
        await this.delete(environment.id),
      ),
    );
  }

  private async cleanUp(environment: Environment) {
    await this.secretService.deleteAllForEnvironment(environment.id);
  }
}
