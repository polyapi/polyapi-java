import { Module } from '@nestjs/common';
import { TeamService } from './team.service';
import { PrismaModule } from 'prisma-module/prisma.module';
import { UserModule } from 'user/user.module';

@Module({
  imports: [PrismaModule, UserModule],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
