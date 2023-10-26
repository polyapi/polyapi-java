import { MigrationContext } from 'migration/types';

export default {
  async run({ authService, prisma }: MigrationContext): Promise<void> {
    const apiKeys = await prisma.apiKey.findMany();
    for (const apiKey of apiKeys) {
      const hashedKey = await authService.hashApiKey(apiKey.key);
      await prisma.apiKey.update({
        where: {
          id: apiKey.id,
        },
        data: {
          key: hashedKey,
        },
      });
    }
  },
  name: '1694673436235_hash_api_keys',
};
