import { Module } from '@nestjs/common';
import { TeamService } from './team.service';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TeamService],
  exports: [TeamService]
})
export class TeamModule {}
