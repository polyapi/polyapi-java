import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Application } from '@prisma/client';
import { ApplicationDto } from '@poly/common';

@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService,
  ) {
  }

  toApplicationDto(application: Application): ApplicationDto {
    return {
      id: application.id,
      name: application.name,
      description: application.description,
    };
  }

  async getAll(tenantId: string) {
    return this.prisma.application.findMany({
      where: {
        tenantId,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.application.findFirst({
      where: {
        id,
      },
    });
  }

  async create(tenantId: string, name: string, description?: string) {
    return this.prisma.application.create({
      data: {
        tenantId,
        name,
        description,
      },
    });
  }

  async update(application: Application, name?: string, description?: string) {
    return this.prisma.application.update({
      where: {
        id: application.id,
      },
      data: {
        name: name || application.name,
        description: description == null ? application.description : description,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.application.delete({
      where: {
        id,
      },
    });
  }
}
