import { FactoryProvider } from '@nestjs/common';
import { getClients } from '../redis';
import { ConfigService } from 'config/config.service';
import { Emitter } from '@socket.io/redis-emitter';

export const EMITTER = Symbol('EMITTER');

export default {
  provide: EMITTER,
  async useFactory(configService: ConfigService) {
    const [pubClient] = await getClients(configService.redisUrl);

    return new Emitter(pubClient, {}, '/events');
  },
  inject: [ConfigService],
} as FactoryProvider;
