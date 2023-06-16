import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { SpecsService } from 'specs/specs.service';
import { Specification, Visibility } from '@poly/model';
import { SpecsModule } from 'specs/specs.module';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { getMockedPolyAuthGuard, mockedAuthData, TypedMock } from '../utils/test-utils';

describe('SpecsController (e2e)', () => {
  let app: INestApplication;

  const getSpecifications = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SpecsModule],
    }).overrideProvider(SpecsService).useValue({
      getSpecifications,
    } as TypedMock<SpecsService>).overrideGuard(PolyAuthGuard).useValue(getMockedPolyAuthGuard())
      .compile();

    app = moduleRef.createNestApplication();

    await app.init();
  });

  beforeEach(() => {
    getSpecifications.mockReset();
  });

  it('GET /specs', async () => {
    // Setup
    const query = {
      contexts: ['jsonplaceholder'],
      names: ['getPost'],
      ids: ['b605ea4f-6e3a-4994-9307-25927024954a'],
    };

    const specifications: Specification[] = [
      {
        context: 'jsonplaceholder',
        id: 'b605ea4f-6e3a-4994-9307-25927024954a',
        type: 'apiFunction',
        description: '',
        function: {
          arguments: [],
          returnType: {} as any,
        },
        name: 'foo',
        visibilityMetadata: {
          visibility: Visibility.Environment,
        },
      },
    ];

    getSpecifications.mockResolvedValue(specifications);

    // action and expect
    return request(app.getHttpServer()).get('/specs').query(query)
      .expect(200)
      .expect(specifications)
      .expect(() => {
        expect(getSpecifications).toHaveBeenCalledWith(mockedAuthData.environment.id, mockedAuthData.tenant.id, query.contexts, query.names, query.ids);
      });
  });
});
