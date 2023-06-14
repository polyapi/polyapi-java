import { TypedMock, getFnMock } from '../utils/test-utils';
import { PrismaService } from 'prisma/prisma.service';

type PrismaEntities = 'apiFunction' | 'webhookHandle';

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

function getEntityMock<Entity extends PrismaEntities>(
  entity: Entity, // eslint-disable-line
): Partial<{
  [key in PrismaAction]: ReturnType<typeof getFnMock>; // eslint-disable-line
}> {
  return {
    findUnique: getFnMock<PrismaService[Entity]['findUnique']>(),
    findMany: getFnMock<PrismaService[Entity]['findMany']>(),
    findFirst: getFnMock<PrismaService[Entity]['findFirst']>(),
    create: getFnMock<PrismaService[Entity]['create']>(),
    update: getFnMock<PrismaService[Entity]['update']>(),
    updateMany: getFnMock<PrismaService[Entity]['updateMany']>(),
    upsert: getFnMock<PrismaService[Entity]['upsert']>(),
    delete: getFnMock<PrismaService[Entity]['delete']>(),
    deleteMany: getFnMock<PrismaService[Entity]['deleteMany']>(),
    aggregate: getFnMock<PrismaService[Entity]['aggregate']>(),
    count: getFnMock<PrismaService[Entity]['count']>(),
  };
}

export default {
  apiFunction: getEntityMock('apiFunction'),
  webhookHandle: getEntityMock('webhookHandle'),
} as TypedMock<PrismaService> & {
  [key in PrismaEntities]: TypedMock<PrismaService[key]>;
};
