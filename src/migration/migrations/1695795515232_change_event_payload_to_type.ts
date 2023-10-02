import { MigrationContext } from 'migration/types';

export const run = async ({ prisma, webhookService }: MigrationContext): Promise<void> => {
  const webhookHandles = await prisma.webhookHandle.findMany();

  for (const webhookHandle of webhookHandles) {
    await prisma.webhookHandle.update({
      where: {
        id: webhookHandle.id,
      },
      data: {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        eventPayloadType: await webhookService.getEventPayloadType(
          webhookHandle.eventPayload ? JSON.parse(webhookHandle.eventPayload) : null,
        ),
      },
    });
  }
};
