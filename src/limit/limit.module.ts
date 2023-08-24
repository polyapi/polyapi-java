import { Module } from '@nestjs/common';
import { LimitService } from './limit.service';
import { PrismaModule } from 'prisma/prisma.module';
import { StatisticsModule } from 'statistics/statistics.module';
import { TierController } from 'limit/tier.controller';

@Module({
  imports: [PrismaModule, StatisticsModule],
  providers: [LimitService],
  controllers: [TierController],
  exports: [LimitService],
})
export class LimitModule {}
