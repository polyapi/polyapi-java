import { Global, Module } from '@nestjs/common';
import { ConfigService } from 'config/config.service';

@Global()
@Module({
  providers: [
    {
      provide: ConfigService,
      useValue: new ConfigService(
        process.env.ENV_PATH
          ? process.env.ENV_PATH
          : process.env.NODE_ENV
            ? `.env.${process.env.NODE_ENV}`
            : '.env',
      ),
    },
  ],
  exports: [ConfigService],
})
export class ConfigModule {
}
