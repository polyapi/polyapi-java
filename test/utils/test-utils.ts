import { ExecutionContext } from '@nestjs/common';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';

import { Role } from '@poly/model';
import { AuthData } from 'common/types';
import { Permission } from '@poly/model';

const currentDate = new Date();

/**
 * remap methods from a type in a new one.
 */
export type ExtractMethods<Type> = {
  [Key in keyof Type as (Type[Key] extends (...args: any[]) => any ? Key : never)]: Type[Key];
}

/**
 * Utility type for using among with `useValue` when mock a provider to get full instellisense about provider methods.
 */
export type TypedMock<T> = Partial<{
  [Key in keyof ExtractMethods<T>]: ExtractMethods<T>[Key] & ExtractMethods<T>[Key] extends (...args: any[]) => any ? ReturnType<typeof getFnMock<ExtractMethods<T>[Key]>> : object;
}>;

const tenantId = '2a918df0-dffd-4773-b2b4-2b5cd3182c5f';
/**
 * Default mocked data used by `getMockedPolyKeyGuard`.
 */
export const mockedAuthData: AuthData = {
  user: {
    id: '3ba47ec4-8871-4fea-a221-c2e322acc3a6',
    name: 'foo',
    role: Role.Admin,
    vip: false,
    tenantId,
    createdAt: currentDate,
  },
  environment: {
    createdAt: currentDate,
    id: '8f095786-e032-48f3-8790-d3eb30865db7',
    name: '',
    subdomain: '',
    tenantId: '',
  },
  tenant: {
    createdAt: currentDate,
    id: 'fbabafff-f506-47fd-8cf3-509d711fcde3',
    name: '',
    publicVisibilityAllowed: true,
    limitTierId: 'a34b1b9e-0b0a-4b0a-9b0a-0b0a0b0a0b0a',
  },
  key: 'b4d1fd5c-8dc2-45e5-9bf3-047a2bcce2ca',
  application: {
    createdAt: currentDate,
    id: 'e3f8af34-eac2-4f66-8da3-3acd38c65eca',
    name: 'application',
    tenantId,
    description: '',
  },
  permissions: {
    [Permission.CustomDev]: true,
    [Permission.Teach]: true,
  },
};

/**
 * Get typed mock using `jest.fn`.
 */
export const getFnMock = <T extends(...args: any) => any>() => jest.fn<ReturnType<T>, Parameters<T>>();

/**
 * Get mocked `PolyAuthGuard`.
 */
export const getMockedPolyAuthGuard = (user: AuthData = mockedAuthData): TypedMock<PolyAuthGuard> => ({
  canActivate: getFnMock<PolyAuthGuard['canActivate']>().mockImplementation(async (context: ExecutionContext) => {
    context.switchToHttp().getRequest().user = user;
    return true;
  }),
});
