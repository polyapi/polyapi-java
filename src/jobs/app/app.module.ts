import { CacheModule, Module } from '@nestjs/common';
import { RedisClientOptions } from 'redis';
import { CacheModuleOptions } from '@nestjs/cache-manager/dist/interfaces/cache-module.interface';
import { redisStore } from 'cache-manager-redis-store';
import { FunctionModule } from 'function/function.module';
import { PrismaModule } from 'prisma-module/prisma.module';

import { JobsModule } from 'jobs/jobs.module';
import { ConfigService } from 'config/config.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async (configService: ConfigService): Promise<RedisClientOptions | CacheModuleOptions> => {
        const password = configService.redisPassword;
        return ({
          store: redisStore as any,
          url: configService.redisUrl,
          ttl: configService.cacheTTL,
          ...(password
            ? {
                password,
              }
            : null),
        });
      },
      inject: [ConfigService],
      isGlobal: true,
    }),
    FunctionModule,
    PrismaModule,
    HttpModule,
  ],
  exports: [],
  controllers: [],
  providers: [],
})
export class AppModule {
}
