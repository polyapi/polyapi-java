import { join } from 'path';
import { Inject, Logger, Module } from '@nestjs/common';
import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import Redis, { RedisOptions } from 'ioredis';
import { CacheModuleOptions } from '@nestjs/cache-manager/dist/interfaces/cache-module.interface';
import { RedisClientOptions } from 'redis';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from 'auth/auth.module';
import { UserModule } from 'user/user.module';
import { FunctionModule } from 'function/function.module';
import { PrismaModule } from 'prisma/prisma.module';
import { ChatModule } from 'chat/chat.module';
import { EventModule } from 'event/event.module';
import { WebhookModule } from 'webhook/webhook.module';
import { CommonModule } from 'common/common.module';
import { ConfigModule } from 'config/config.module';
import { AiModule } from 'ai/ai.module';
import { AuthProviderModule } from 'auth-provider/auth-provider.module';
import { SpecsModule } from 'specs/specs.module';
import { GptPluginModule } from 'gptplugin/gptplugin.module';
import { TenantModule } from 'tenant/tenant.module';
import { TeamModule } from 'team/team.module';
import { EnvironmentModule } from 'environment/environment.module';
import { ApplicationModule } from 'application/application.module';
import { ConfigVariableModule } from 'config-variable/config-variable.module';
import { VariableModule } from 'variable/variable.module';
import { SecretModule } from 'secret/secret.module';
import { ConfigService } from 'config/config.service';
import { MigrationModule } from 'migration/migration.module';
import { TriggerModule } from 'trigger/trigger.module';
import { DocsModule } from 'docs/docs.module';
import { LimitModule } from 'limit/limit.module';
import { StatisticsModule } from 'statistics/statistics.module';

const isRedisAvailable = async (url: string): Promise<boolean> => {
  const redisOptions: RedisOptions = {
    maxRetriesPerRequest: 1,
  };

  const redisClient = new Redis(url, redisOptions);
  try {
    await redisClient.ping();
    return true;
  } catch (error) {
    return false;
  } finally {
    redisClient.disconnect();
  }
};

const logger = new Logger('AppModule');

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'public'),
      renderPath: '/',
    }),
    CacheModule.registerAsync({
      useFactory: async (configService: ConfigService): Promise<RedisClientOptions | CacheModuleOptions> => {
        if (await isRedisAvailable(configService.redisUrl)) {
          logger.log('Using Redis cache');
          return ({
            store: redisStore as any,
            url: configService.redisUrl,
            ttl: configService.cacheTTL,
          });
        } else {
          logger.log('Using memory cache');
          return ({
            store: 'memory',
          });
        }
      },
      inject: [ConfigService],
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    ConfigModule,
    CommonModule,
    TenantModule,
    EnvironmentModule,
    TeamModule,
    UserModule,
    AuthModule,
    FunctionModule,
    WebhookModule,
    AuthProviderModule,
    EventModule,
    SpecsModule,
    AiModule,
    ChatModule,
    GptPluginModule,
    ApplicationModule,
    ConfigVariableModule,
    VariableModule,
    SecretModule,
    MigrationModule,
    TriggerModule,
    DocsModule,
    LimitModule,
    StatisticsModule,
  ],
  exports: [ConfigModule],
})
export class AppModule {
  constructor(@Inject(CACHE_MANAGER) cacheManager: Cache & { store: any }) {
    const client = cacheManager.store.getClient?.();

    client?.on('error', (error) => {
      logger.error('Redis error: ', error);
    });
  }
}
