import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Team, Tenant } from '@prisma/client';
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

  async getTeamById(teamId) {
    return this.prisma.team.findFirst({
      where: {
        id: teamId,
      },
    });
  }
}
