import { MigrationContext } from 'migration/types';

export default {
  async run({ prisma, webhookService }: MigrationContext): Promise<void> {
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
  },
  name: '1695795515232_change_event_payload_to_type',
};
