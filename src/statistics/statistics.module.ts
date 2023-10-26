import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma-module/prisma.module';
import { StatisticsService } from './statistics.service';
import { PerfLogInfoProvider } from 'statistics/perf-log-info-provider';

@Module({
  imports: [PrismaModule],
  providers: [StatisticsService, PerfLogInfoProvider],
  exports: [StatisticsService, PerfLogInfoProvider],
})
export class StatisticsModule {}
