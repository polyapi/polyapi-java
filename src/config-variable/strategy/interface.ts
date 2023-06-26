import { ConfigVariable } from '@prisma/client';

export interface Strategy {
    get(name: string, tenantId: string | null, environmentId: string | null): Promise<ConfigVariable | null>;
    configure(name: string, value: unknown, tenantId: string | null, environmentId: string | null): Promise<ConfigVariable>;
}
