import { getFnMock, TypedMock } from '../utils/test-utils';
import { PrismaService } from 'prisma/prisma.service';

type PrismaEntities = 'apiFunction' | 'webhookHandle' | 'variable' | 'environment' | 'tenant' | 'conversation';

/**
 * This was taken from prisma client code since saddly prisma client module doesn't export `PrismaAction` I have had to add it manually here.
 */
type PrismaAction =
  | 'findUnique'
  | 'findMany'
  | 'findFirst'
  | 'create'
  | 'update'
  | 'updateMany'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'queryRaw'
  | 'aggregate'
  | 'count';

const getEntityMock = <Entity extends PrismaEntities>(
  entity: Entity, // eslint-disable-line
): Partial<{
  [key in PrismaAction]: ReturnType<typeof getFnMock>; // eslint-disable-line
}> => ({
    findUnique: getFnMock<PrismaService[Entity]['findUnique']>(),
    findMany: getFnMock<PrismaService[Entity]['findMany']>(),
    findFirst: getFnMock<PrismaService[Entity]['findFirst']>(),
    create: getFnMock<PrismaService[Entity]['create']>().mockImplementation(({ data }) => Promise.resolve(data) as any),
    update: getFnMock<PrismaService[Entity]['update']>().mockImplementation(({ data }) => Promise.resolve(data) as any),
    updateMany: getFnMock<PrismaService[Entity]['updateMany']>(),
    upsert: getFnMock<PrismaService[Entity]['upsert']>(),
    delete: getFnMock<PrismaService[Entity]['delete']>(),
    deleteMany: getFnMock<PrismaService[Entity]['deleteMany']>(),
    aggregate: getFnMock<PrismaService[Entity]['aggregate']>(),
    count: getFnMock<PrismaService[Entity]['count']>(),
  });

export default {
  $transaction: getFnMock<PrismaService['$transaction']>(),
  apiFunction: getEntityMock('apiFunction'),
  webhookHandle: getEntityMock('webhookHandle'),
  variable: getEntityMock('variable'),
  tenant: getEntityMock('tenant'),
  environment: getEntityMock('environment'),
  conversation: getEntityMock('conversation'),
} as TypedMock<PrismaService> & {
  [key in PrismaEntities]: TypedMock<PrismaService[key]>;
};
