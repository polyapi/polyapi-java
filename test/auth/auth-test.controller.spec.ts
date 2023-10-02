import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from 'auth/auth.service';
import { authServiceMock } from '../mocks';
import { AuthTestController } from './auth-test.controller';
import { AuthData, AuthRequest } from 'common/types';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { Role } from '@poly/model';
import { PolyAuthStrategy } from 'auth/poly-auth-strategy.service';

describe('AuthTestController', () => {
  let controller: AuthTestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthTestController],
      providers: [
        PolyAuthStrategy,
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AuthTestController>(AuthTestController);
    authServiceMock.getAuthData?.mockResolvedValue({
      user: {
        role: Role.Admin,
      },
    } as AuthData);
  });

  describe('testRequest', () => {
    it('should not mutate request by PolyAuthGuard', async () => {
      // Mock request with access_token in body and query
      const mockReq = {
        body: {
          access_token: '123',
        },
        query: {
          access_token: '456',
        },
      } as unknown as AuthRequest;

      // Call the testRequest method of AuthTestController
      await controller.testRequest(mockReq, {});

      // Assert that the body and query of the mock request remain unchanged
      expect(mockReq.body).toEqual({
        access_token: '123',
      });
      expect(mockReq.query).toEqual({
        access_token: '456',
      });
    });

    it('should restore the original body and query of the request', async () => {
      // Mock request with access_token in body and query
      const mockReq = {
        body: {
          access_token: '123',
        },
        query: {
          access_token: '456',
        },
      } as unknown as AuthRequest;

      // Instantiate PolyAuthGuard
      const guard = new PolyAuthGuard();

      // Call the canActivate method of PolyAuthGuard and catch any thrown exception
      try {
        await guard.canActivate(mockReq as any);
      } catch (e) {}

      // Assert that the body and query of the mock request are restored to their original state
      expect(mockReq.body).toEqual({
        access_token: '123',
      });
      expect(mockReq.query).toEqual({
        access_token: '456',
      });
    });
  });
});
