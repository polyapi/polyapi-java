/* eslint-disable @typescript-eslint/ban-ts-comment */
import { PublicVisibilityStrategy } from 'config-variable/strategy/public-visibility-strategy';
import { PrismaService } from 'prisma-module/prisma.service';
import { CommonService } from 'common/common.service';

describe('PublicVisibilityStrategy', () => {
  let strategy: PublicVisibilityStrategy;

  beforeEach(() => {
    strategy = new PublicVisibilityStrategy(
      jest.mocked(PrismaService) as any,
      jest.mocked(CommonService) as any,
    );
  });

  describe('getEffectiveContextPaths', () => {
    test('Basic test', () => {
      const tenantVisibleContexts = ['ABC', 'CDE'];
      const environmentVisibleContexts = ['ABC.subpath', 'FDE'];
      // @ts-ignore
      const result = strategy.getEffectiveContextPaths(tenantVisibleContexts, environmentVisibleContexts);
      expect(result).toEqual(['ABC.subpath']);
    });

    test('Both arrays are the same', () => {
      const tenantVisibleContexts = ['XYZ'];
      const environmentVisibleContexts = ['XYZ'];
      // @ts-ignore
      const result = strategy.getEffectiveContextPaths(tenantVisibleContexts, environmentVisibleContexts);
      expect(result).toEqual(['XYZ']);
    });

    test('Both arrays have matching paths', () => {
      const tenantVisibleContexts = ['XYZ'];
      const environmentVisibleContexts = ['XYZ.path1', 'XYZ.path2'];
      // @ts-ignore
      const result = strategy.getEffectiveContextPaths(tenantVisibleContexts, environmentVisibleContexts);
      expect(result).toEqual(['XYZ.path1', 'XYZ.path2']);
    });

    test('Mixed matching paths', () => {
      const tenantVisibleContexts = ['ABC', 'XYZ'];
      const environmentVisibleContexts = ['XYZ.path', 'ABC.path', 'PQR'];
      // @ts-ignore
      const result = strategy.getEffectiveContextPaths(tenantVisibleContexts, environmentVisibleContexts);
      expect(result).toEqual(['XYZ.path', 'ABC.path']);
    });

    test('No matching paths', () => {
      const tenantVisibleContexts = ['ABC'];
      const environmentVisibleContexts = ['DEF'];
      // @ts-ignore
      const result = strategy.getEffectiveContextPaths(tenantVisibleContexts, environmentVisibleContexts);
      expect(result).toEqual([]);
    });

    test('Empty tenantVisibleContexts array', () => {
      const tenantVisibleContexts = [];
      const environmentVisibleContexts = ['ABC.path', 'DEF.path'];
      // @ts-ignore
      const result = strategy.getEffectiveContextPaths(tenantVisibleContexts, environmentVisibleContexts);
      expect(result).toEqual([]);
    });

    test('tenantVisibleContexts is undefined', () => {
      const tenantVisibleContexts = undefined;
      const environmentVisibleContexts = ['ABC.subpath', 'FDE'];
      // @ts-ignore
      const result = strategy.getEffectiveContextPaths(tenantVisibleContexts, environmentVisibleContexts);
      expect(result).toEqual(environmentVisibleContexts);
    });

    test('environmentVisibleContexts is undefined', () => {
      const tenantVisibleContexts = ['ABC', 'CDE'];
      const environmentVisibleContexts = undefined;
      // @ts-ignore
      const result = strategy.getEffectiveContextPaths(tenantVisibleContexts, environmentVisibleContexts);
      expect(result).toEqual(tenantVisibleContexts);
    });

    test('Both tenantVisibleContexts and environmentVisibleContexts are undefined', () => {
      // @ts-ignore
      const result = strategy.getEffectiveContextPaths(undefined, undefined);
      expect(result).toEqual([]);
    });
  });
});
