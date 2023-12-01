import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

let pubClient: RedisClient | null = null;
let subClient: RedisClient | null = null;

export const getClients = async (url: string): Promise<[ReturnType<typeof createClient>, ReturnType<typeof createClient> ]> => {
  if (!pubClient && !subClient) {
    pubClient = createClient({ url });
    subClient = createClient({ url });
    await Promise.all([pubClient.connect(), subClient.connect()]);
  }

  return [pubClient, subClient] as [RedisClient, RedisClient];
};
