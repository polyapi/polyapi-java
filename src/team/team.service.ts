import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma-module/prisma.service';
import { Team, TeamMember, User } from '@prisma/client';
import { TeamDto, TeamMemberDto } from '@poly/model';
import { UserService } from 'user/user.service';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(private readonly prisma: PrismaService, private readonly userService: UserService) {
  }

  toTeamDto(team: Team): TeamDto {
    return {
      id: team.id,
      name: team.name,
    };
  }

  toMemberDto(teamMember: TeamMember & { user: User }): TeamMemberDto {
    return {
      id: teamMember.id,
      user: this.userService.toUserDto(teamMember.user),
      teamId: teamMember.teamId,
    };
  }

  async createTeam(tenantId: string, name: string) {
    this.logger.log(`Creating team '${name}' in tenant ${tenantId}`);
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

  async updateTeam(team: Team, name: string) {
    this.logger.log(`Updating team '${team.name}' to '${name}'`);
    return this.prisma.team.update({
      where: {
        id: team.id,
      },
      data: {
        name,
      },
    });
  }

  async deleteTeam(id: string) {
    this.logger.log(`Deleting team ${id}`);
    return this.prisma.team.delete({
      where: {
        id,
      },
    });
  }

  async findTeamById(teamId: string) {
    return this.prisma.team.findFirst({
      where: {
        id: teamId,
      },
    });
  }

  async getAllTeamsByTenant(tenantId: any) {
    return this.prisma.team.findMany({
      where: {
        tenantId,
      },
    });
  }

  async checkMemberExists(teamId: string, userId: string) {
    const member = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
      },
    });
    return !!member;
  }

  async findMemberById(id: string) {
    return this.prisma.teamMember.findFirst({
      where: {
        id,
      },
      include: {
        user: true,
      },
    });
  }

  async createMember(teamId: string, userId: string) {
    this.logger.log(`Creating team member ${userId} in team ${teamId}`);
    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId,
      },
      include: {
        user: true,
      },
    });
  }

  async deleteMember(id: string) {
    this.logger.log(`Deleting team member ${id}`);
    return this.prisma.teamMember.delete({
      where: {
        id,
      },
    });
  }

  async getAllMembersByTeam(teamId: string) {
    return this.prisma.teamMember.findMany({
      where: {
        teamId,
      },
      include: {
        user: true,
      },
    });
  }
}
