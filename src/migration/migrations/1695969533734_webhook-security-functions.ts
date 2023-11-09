import { MigrationContext } from 'migration/types';

export default {
  async run({ prisma }: MigrationContext): Promise<void> {
    const webhookHandles = await prisma.webhookHandle.findMany({
      where: {
        NOT: {
          securityFunctions: {
            equals: null,
          },
        },
      },
    });

    for (const webhookHandle of webhookHandles) {
      if (!webhookHandle.securityFunctions) {
        continue;
      }
      const securityFunctionIds = JSON.parse(webhookHandle.securityFunctions);
      const securityFunctions = securityFunctionIds.map((id: string) => ({
        id,
      }));

      await prisma.webhookHandle.update({
        where: {
          id: webhookHandle.id,
        },
        data: {
          securityFunctions: JSON.stringify(securityFunctions),
        },
      });
    }
  },
  name: '1695969533734_webhook-security-functions',
};
