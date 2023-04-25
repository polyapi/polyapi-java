import {join} from 'path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from 'auth/auth.module';
import { UserModule } from 'user/user.module';
import { FunctionModule } from 'function/function.module';
import { TeachModule } from 'teach/teach.module';
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

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'public'),
      renderPath: '/'
    }),
    PrismaModule,
    ConfigModule,
    CommonModule,
    TenantModule,
    EnvironmentModule,
    TeamModule,
    UserModule,
    AuthModule,
    TeachModule,
    FunctionModule,
    WebhookModule,
    AuthProviderModule,
    EventModule,
    SpecsModule,
    AiModule,
    ChatModule,
    GptPluginModule,
  ],
  exports: [
    ConfigModule,
  ],
})
export class AppModule {
}
