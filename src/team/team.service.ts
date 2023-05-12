import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Team } from '@prisma/client';
import { TeamDto } from '@poly/common';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {
  }

  toDto(team: Team): TeamDto {
    return {
      id: team.id,
      name: team.name,
    };
  }

  async create(tenantId: string, name: string) {
    return this.prisma.team.create({
      data: {
        tenant: {
          connect: {
            id: tenantId,
          },
        },
        name,
      },
    });
  }

  async update(team: Team, name: string) {
    return this.prisma.team.update({
      where: {
        id: team.id,
      },
      data: {
        name,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.team.delete({
      where: {
        id,
      },
    });
  }

  async findById(teamId) {
    return this.prisma.team.findFirst({
      where: {
        id: teamId,
      },
    });
  }

  async getAllByTenant(tenantId: any) {
    return this.prisma.team.findMany({
      where: {
        tenantId,
      },
    });
  }
}
