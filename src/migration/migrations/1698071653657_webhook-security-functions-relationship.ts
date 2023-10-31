import { MigrationContext } from 'migration/types';
import { WebhookSecurityFunction } from '../../../packages/model/src/dto';

export const run = async ({ prisma, loggerService }: MigrationContext): Promise<void> => {
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
    const securityFunctionIds = JSON.parse(webhookHandle.securityFunctions) as WebhookSecurityFunction[];

    for (const securityFunction of securityFunctionIds) {
      const customFunction = await prisma.customFunction.findFirst({
        where: {
          id: securityFunction.id,
        },
      });

      if (!customFunction) {
        continue;
      }

      try {
        await prisma.customFunctionWebhookHandle.create({
          data: {
            custom_function_id: customFunction.id,
            webhook_handle_id: webhookHandle.id,
            message: securityFunction.message,
          },
        });
      } catch (err) {
        loggerService.error(`Failed to create FunctionWebhookHandle record, webhookHandle="${webhookHandle.id}" - customFunction="$${customFunction.id}"`, err);
      }
    }
  }
};
