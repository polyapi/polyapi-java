import { PrismaService } from 'prisma/prisma.service';

export function findMany(prismaService: PrismaService, name: string | null, tenantId: string | null = null, environmentId: string | null = null) {
  const orConditions: [{ name?: string, tenantId: string | null, environmentId?: string | null }] = [
    {
      ...(name ? { name } : {}),
      tenantId: null,
      environmentId: null,
    },
  ];

  if (tenantId) {
    orConditions.push({
      ...(name ? { name } : {}),
      tenantId,
      environmentId: null,
    });
  }
  if (environmentId) {
    orConditions.push({
      ...(name ? { name } : {}),
      tenantId,
      environmentId,
    });
  }

  return prismaService.configVariable.findMany({
    where: {
      OR: orConditions,
    },
  });
}
