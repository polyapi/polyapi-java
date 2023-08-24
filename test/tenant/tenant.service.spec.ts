import { Test } from '@nestjs/testing';
import { Tenant } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { EnvironmentService } from 'environment/environment.service';
import {
  applicationServiceMock,
  authServiceMock,
  configServiceMock,
  environmentServiceMock,
  prismaServiceMock, teamServiceMock, userServiceMock,
} from '../mocks';
import { resetMocks } from '../mocks/utils';
import { ConfigService } from 'config/config.service';
import { TenantService } from 'tenant/tenant.service';
import { AuthService } from 'auth/auth.service';
import { ApplicationService } from 'application/application.service';
import { TeamService } from 'team/team.service';
import { UserService } from 'user/user.service';

describe('TenantService', () => {
  const testTenant: Tenant = {
    id: 'id12345',
    name: 'name12345',
    createdAt: new Date(),
    publicVisibilityAllowed: true,
    limitTierId: 'a34b1b9e-0b0a-4b0a-9b0a-0b0a0b0a0b0a',
  };

  let service: TenantService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: ApplicationService,
          useValue: applicationServiceMock,
        },
        {
          provide: TeamService,
          useValue: teamServiceMock,
        },
        {
          provide: UserService,
          useValue: userServiceMock,
        },
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
        {
          provide: EnvironmentService,
          useValue: environmentServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);

    resetMocks(prismaServiceMock, environmentServiceMock, configServiceMock);

    prismaServiceMock.tenant.delete?.mockResolvedValue(testTenant);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('toDto', () => {
    it('should return dto', async () => {
      const result = await service.toDto(testTenant);
      expect(result).toEqual({
        id: testTenant.id,
        name: testTenant.name,
        publicVisibilityAllowed: testTenant.publicVisibilityAllowed,
        limitTierId: testTenant.limitTierId,
      });
    });
  });

  describe('delete', () => {
    it('should call deleteAllByTenant on EnvironmentService on delete ', async () => {
      await service.delete('id12345');
      expect(environmentServiceMock.deleteAllByTenant).toBeCalledTimes(1);
      expect(environmentServiceMock.deleteAllByTenant).toBeCalledWith('id12345');
    });
  });
});
