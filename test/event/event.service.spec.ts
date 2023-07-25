/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Test } from '@nestjs/testing';
import { EventService } from 'event/event.service';
import { Socket } from 'socket.io';
import { AuthService } from 'auth/auth.service';
import { authServiceMock } from '../mocks';
import { Environment, Variable } from '@prisma/client';
import { AuthData } from 'common/types';
import { Visibility } from '@poly/model';

describe('EventService', () => {
  let service: EventService;
  let socket1: Socket;
  let socket2: Socket;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EventService,
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile();

    service = module.get(EventService);

    socket1 = {
      id: 'socket1',
      emit: jest.fn(),
      on: jest.fn(),
    } as any;

    socket2 = {
      id: 'socket2',
      emit: jest.fn(),
      on: jest.fn(),
    } as any;
  });

  describe('registerErrorHandler', () => {
    it('should register handler with auth data', () => {
      const authData = {
        key: 'key',
      } as AuthData;
      service.registerErrorHandler(socket1, authData, 'path');
      // @ts-ignore
      const handler = service.errorHandlers[0];
      expect(handler.authData).toBe(authData);
    });

    it('should register handler with applicationIds filter', () => {
      const authData = {
        key: 'key',
      } as AuthData;
      service.registerErrorHandler(socket1, authData, 'path', ['app1']);
      // @ts-ignore
      const handler = service.errorHandlers[0];
      expect(handler.applicationIds).toEqual(['app1']);
      expect(handler.environmentIds).toEqual(undefined);
      expect(handler.functionIds).toEqual(undefined);
      expect(handler.tenant).toEqual(undefined);
    });

    it('should register handler with environmentsIds filter', () => {
      const authData = {
        key: 'key',
      } as AuthData;
      service.registerErrorHandler(socket1, authData, 'path', undefined, ['env1']);
      // @ts-ignore
      const handler = service.errorHandlers[0];
      expect(handler.applicationIds).toEqual(undefined);
      expect(handler.environmentIds).toEqual(['env1']);
      expect(handler.functionIds).toEqual(undefined);
      expect(handler.tenant).toEqual(undefined);
    });

    it('should register handler with functionIds filter', () => {
      const authData = {
        key: 'key',
      } as AuthData;
      service.registerErrorHandler(socket1, authData, 'path', undefined, undefined, ['func1']);
      // @ts-ignore
      const handler = service.errorHandlers[0];
      expect(handler.applicationIds).toEqual(undefined);
      expect(handler.environmentIds).toEqual(undefined);
      expect(handler.functionIds).toEqual(['func1']);
      expect(handler.tenant).toEqual(undefined);
    });

    it('should register handler with tenant filter', () => {
      const authData = {
        key: 'key',
      } as AuthData;
      service.registerErrorHandler(socket1, authData, 'path', undefined, undefined, undefined, true);
      // @ts-ignore
      const handler = service.errorHandlers[0];
      expect(handler.applicationIds).toEqual(undefined);
      expect(handler.environmentIds).toEqual(undefined);
      expect(handler.functionIds).toEqual(undefined);
      expect(handler.tenant).toEqual(true);
    });
  });

  describe('unregisterErrorHandler', () => {
    it('removes handler socket', () => {
      const authData = {
        key: 'key',
      } as AuthData;

      // register handler
      const id = service.registerErrorHandler(socket1, authData, 'path1');

      // unregister
      service.unregisterErrorHandler(socket1, id);

      // @ts-ignore
      expect(service.errorHandlers).toEqual([]);
    });

    it('does not throw error if handler does not exist', () => {
      expect(() => {
        service.unregisterErrorHandler(socket1, 'handlerId');
      }).not.toThrow();
    });
  });

  describe('sendErrorEvent', () => {
    const environmentEntity = {
      id: 'entity1',
      environmentId: 'env1',
      environment: {
        tenantId: 'tenant1',
      } as Environment,
      visibility: Visibility.Environment,
    };

    beforeEach(() => {
      authServiceMock.hasEnvironmentEntityAccess?.mockResolvedValue(true);
    });

    it('should send to handlers matching path', async () => {
      const authData = {
        tenant: {
          id: 'tenant1',
        },
      } as AuthData;
      service.registerErrorHandler(socket1, authData, 'path1');

      await service.sendErrorEvent(
        environmentEntity.id,
        environmentEntity.environmentId,
        environmentEntity.environment.tenantId,
        environmentEntity.visibility,
        null,
        null,
        'path1',
        {
          message: 'errorMessage',
          data: {},
          status: 69,
          statusText: 'Test Error',
        });

      expect(socket1.emit).toBeCalled();
      expect(socket2.emit).not.toBeCalled();
    });

    it('should not send to handlers not matching path', async () => {
      const authData = {} as AuthData;
      service.registerErrorHandler(socket1, authData, 'path2');

      await service.sendErrorEvent(
        environmentEntity.id,
        environmentEntity.environmentId,
        environmentEntity.environment.tenantId,
        environmentEntity.visibility,
        null,
        null,
        'path1',
        {
          message: 'errorMessage',
          data: {},
          status: 69,
          statusText: 'Test Error',
        });

      expect(socket1.emit).not.toBeCalled();
      expect(socket2.emit).not.toBeCalled();
    });

    it('should not send if no access based on auth data', async () => {
      const authData = {
        tenant: {
          id: 'tenant2',
        },
      } as AuthData;
      service.registerErrorHandler(socket1, authData, 'path1');

      await service.sendErrorEvent(environmentEntity.id,
        environmentEntity.environmentId,
        environmentEntity.environment.tenantId,
        environmentEntity.visibility,
        null,
        null,
        'path1',
        {
          message: 'errorMessage',
          data: {},
          status: 69,
          statusText: 'Test Error',
        });

      expect(socket1.emit).not.toBeCalled();
      expect(socket2.emit).not.toBeCalled();
    });

    it('should send only to specific application', async () => {
      const authData1 = {
        application: {
          id: 'app1',
        },
        tenant: {
          id: 'tenant1',
        },
      } as AuthData;
      const authData2 = {
        application: {
          id: 'app2',
        },
        tenant: {
          id: 'tenant1',
        },
      } as AuthData;
      service.registerErrorHandler(socket1, authData1, 'path1');
      service.registerErrorHandler(socket2, authData2, 'path1');

      await service.sendErrorEvent(environmentEntity.id,
        environmentEntity.environmentId,
        environmentEntity.environment.tenantId,
        environmentEntity.visibility,
        'app1',
        null,
        'path1',
        {
          message: 'errorMessage',
          data: {},
          status: 69,
          statusText: 'Test Error',
        });

      expect(socket1.emit).toBeCalled();
      expect(socket2.emit).not.toBeCalled();
    });

    it('should send only to defined applications', async () => {
      const authData1 = {
        application: {
          id: 'app1',
        },
        tenant: {
          id: 'tenant1',
        },
      } as AuthData;
      const authData2 = {
        application: {
          id: 'app2',
        },
        tenant: {
          id: 'tenant1',
        },
      } as AuthData;
      service.registerErrorHandler(socket1, authData1, 'path1', ['app1']);
      service.registerErrorHandler(socket2, authData2, 'path1', ['app1']);

      await service.sendErrorEvent(environmentEntity.id,
        environmentEntity.environmentId,
        environmentEntity.environment.tenantId,
        environmentEntity.visibility,
        'app1',
        null,
        'path1',
        {
          message: 'errorMessage',
          data: {},
          status: 69,
          statusText: 'Test Error',
        });

      expect(socket1.emit).toBeCalled();
      expect(socket2.emit).toBeCalled();
    });

    it('should send only to defined environments', async () => {
      const authData1 = {
        application: {
          id: 'app1',
        },
        tenant: {
          id: 'tenant1',
        },
      } as AuthData;
      const authData2 = {
        application: {
          id: 'app2',
        },
        tenant: {
          id: 'tenant1',
        },
      } as AuthData;
      service.registerErrorHandler(socket1, authData1, 'path1', undefined, ['env1']);
      service.registerErrorHandler(socket2, authData2, 'path1', undefined, ['env1']);

      await service.sendErrorEvent(environmentEntity.id,
        environmentEntity.environmentId,
        environmentEntity.environment.tenantId,
        environmentEntity.visibility,
        'app1',
        null,
        'path1',
        {
          message: 'errorMessage',
          data: {},
          status: 69,
          statusText: 'Test Error',
        });

      expect(socket1.emit).toBeCalled();
      expect(socket2.emit).toBeCalled();
    });

    it('should send only to defined functions', async () => {
      const authData1 = {
        application: {
          id: 'app1',
        },
        tenant: {
          id: 'tenant1',
        },
      } as AuthData;
      const authData2 = {
        application: {
          id: 'app1',
        },
        tenant: {
          id: 'tenant1',
        },
      } as AuthData;
      service.registerErrorHandler(socket1, authData1, 'path1', undefined, undefined, ['entity1']);
      service.registerErrorHandler(socket2, authData2, 'path1', undefined, undefined, ['entity2']);

      await service.sendErrorEvent(
        environmentEntity.id,
        environmentEntity.environmentId,
        environmentEntity.environment.tenantId,
        environmentEntity.visibility,
        'app1',
        null,
        'path1',
        {
          message: 'errorMessage',
          data: {},
          status: 69,
          statusText: 'Test Error',
        });

      expect(socket1.emit).toBeCalled();
      expect(socket2.emit).not.toBeCalled();
    });

    it('should send only to auth data tenant', async () => {
      const authData1 = {
        application: {
          id: 'app1',
        },
        tenant: {
          id: 'tenant1',
        },
      } as AuthData;
      const authData2 = {
        application: {
          id: 'app2',
        },
        tenant: {
          id: 'tenant2',
        },
      } as AuthData;
      service.registerErrorHandler(socket1, authData1, 'path1', undefined, undefined, undefined, true);
      service.registerErrorHandler(socket2, authData2, 'path1', undefined, undefined, undefined, true);

      await service.sendErrorEvent(
        environmentEntity.id,
        environmentEntity.environmentId,
        environmentEntity.environment.tenantId,
        environmentEntity.visibility,
        'app1',
        null,
        'path1',
        {
          message: 'errorMessage',
          data: {},
          status: 69,
          statusText: 'Test Error',
        });

      expect(socket1.emit).toBeCalled();
      expect(socket2.emit).not.toBeCalled();
    });
  });

  describe('registerWebhookEventHandler', () => {
    it('registers new webhook handler', () => {
      service.registerWebhookEventHandler(socket1, 'client1', 'webhook1');

      // @ts-ignore
      expect(service.webhookEventHandlers['client1']['webhook1']).toEqual([socket1]);
    });

    it('adds socket to existing handler', () => {
      service.registerWebhookEventHandler(socket1, 'client1', 'webhook1');
      service.registerWebhookEventHandler(socket2, 'client1', 'webhook1');

      // @ts-ignore
      expect(service.webhookEventHandlers['client1']['webhook1']).toEqual([socket1, socket2]);
    });
  });

  describe('unregisterWebhookEventHandler', () => {
    it('removes handler socket', () => {
      // register handler
      service.registerWebhookEventHandler(socket1, 'client1', 'webhook1');

      // unregister
      service.unregisterWebhookEventHandler(socket1, 'client1', 'webhook1');

      // @ts-ignore
      expect(service.webhookEventHandlers['client1']['webhook1']).toEqual([]);
    });

    it('does not throw error if handler does not exist', () => {
      expect(() => {
        service.unregisterWebhookEventHandler(socket1, 'client1', 'webhook1');
      }).not.toThrow();
    });
  });

  describe('sendWebhookEvent', () => {
    it('sends event to matching handlers', () => {
      // register handlers
      service.registerWebhookEventHandler(socket1, 'client1', 'webhook1');
      service.registerWebhookEventHandler(socket2, 'client2', 'webhook1');

      // send event
      service.sendWebhookEvent('webhook1', { payload: 'data' });

      // check socket emits called
      expect(socket1.emit).toBeCalledWith('handleWebhookEvent:webhook1', { payload: 'data' });
      expect(socket2.emit).toBeCalledWith('handleWebhookEvent:webhook1', { payload: 'data' });
    });

    it('does not send event if no matching handlers', () => {
      // send event
      service.sendWebhookEvent('webhook1', { payload: 'data' });

      // check nothing emitted
      expect(socket1.emit).not.toBeCalled();
      expect(socket2.emit).not.toBeCalled();
    });
  });

  describe('registerAuthFunctionEventHandler', () => {
    it('registers new auth function handler', () => {
      service.registerAuthFunctionEventHandler(socket1, 'client1', 'func1');

      // @ts-ignore
      expect(service.authFunctionHandlers['client1']['func1']).toEqual([socket1]);
    });

    it('adds socket to existing handler', () => {
      service.registerAuthFunctionEventHandler(socket1, 'client1', 'func1');
      service.registerAuthFunctionEventHandler(socket2, 'client1', 'func1');

      // @ts-ignore
      expect(service.authFunctionHandlers['client1']['func1']).toEqual([socket1, socket2]);
    });

    it('does not add duplicate socket', () => {
      service.registerAuthFunctionEventHandler(socket1, 'client1', 'func1');
      service.registerAuthFunctionEventHandler(socket1, 'client1', 'func1');

      // @ts-ignore
      expect(service.authFunctionHandlers['client1']['func1']).toEqual([socket1]);
    });
  });

  describe('unregisterAuthFunctionEventHandler', () => {
    it('removes handler socket', () => {
      // register handler
      service.registerAuthFunctionEventHandler(socket1, 'client1', 'func1');

      // unregister
      service.unregisterAuthFunctionEventHandler(socket1, 'client1', 'func1');

      // @ts-ignore
      expect(service.authFunctionHandlers['client1']['func1']).toEqual([]);
    });

    it('does not throw error if handler does not exist', () => {
      expect(() => {
        service.unregisterAuthFunctionEventHandler(socket1, 'client1', 'func1');
      }).not.toThrow();
    });
  });

  describe('sendAuthFunctionEvent', () => {
    it('sends event to matching handler', () => {
      // register handler
      service.registerAuthFunctionEventHandler(socket1, 'client1', 'func1');

      // send event
      service.sendAuthFunctionEvent('func1', 'client1', { payload: 'data' });

      // check socket emit called
      expect(socket1.emit).toBeCalledWith('handleAuthFunctionEvent:func1', { payload: 'data' });
    });

    it('sends to all clients if clientId not specified', () => {
      // register handlers
      service.registerAuthFunctionEventHandler(socket1, 'client1', 'func1');
      service.registerAuthFunctionEventHandler(socket2, 'client2', 'func1');

      // send event without clientId
      service.sendAuthFunctionEvent('func1', null, { payload: 'data' });

      // check all sockets emit called
      expect(socket1.emit).toBeCalledWith('handleAuthFunctionEvent:func1', { payload: 'data' });
      expect(socket2.emit).toBeCalledWith('handleAuthFunctionEvent:func1', { payload: 'data' });
    });

    it('does not send event if no matching handlers', () => {
      // send event
      service.sendAuthFunctionEvent('func1', 'client1', { payload: 'data' });

      // check nothing emitted
      expect(socket1.emit).not.toBeCalled();
    });
  });

  // ...other tests

  describe('registerVariableChangeEventHandler', () => {
    it('registers new variable change handler', () => {
      service.registerVariableChangeEventHandler(socket1, 'client1', 'var1');

      // @ts-ignore
      expect(service.variableChangeHandlers['client1']['var1']).toEqual([socket1]);
    });

    it('adds socket to existing handler', () => {
      service.registerVariableChangeEventHandler(socket1, 'client1', 'var1');
      service.registerVariableChangeEventHandler(socket2, 'client1', 'var1');

      // @ts-ignore
      expect(service.variableChangeHandlers['client1']['var1']).toEqual([socket1, socket2]);
    });

    it('does not add duplicate socket', () => {
      service.registerVariableChangeEventHandler(socket1, 'client1', 'var1');
      service.registerVariableChangeEventHandler(socket1, 'client1', 'var1');

      // @ts-ignore
      expect(service.variableChangeHandlers['client1']['var1']).toEqual([socket1]);
    });
  });

  describe('unregisterVariableChangeEventHandler', () => {
    it('removes handler socket', () => {
      // register handler
      service.registerVariableChangeEventHandler(socket1, 'client1', 'var1');

      // unregister
      service.unregisterVariableChangeEventHandler(socket1, 'client1', 'var1');

      // @ts-ignore
      expect(service.variableChangeHandlers['client1']['var1']).toEqual([]);
    });

    it('does not throw error if handler does not exist', () => {
      expect(() => {
        service.unregisterVariableChangeEventHandler(socket1, 'client1', 'var1');
      }).not.toThrow();
    });
  });

  describe('sendVariableChangeEvent', () => {
    beforeEach(() => {
      authServiceMock.hasEnvironmentEntityAccess?.mockResolvedValue(true);
    });

    it('sends event to matching handler', async () => {
      // register handler
      service.registerVariableChangeEventHandler(socket1, 'client1', 'var1');

      const variable = {
        id: 'var1',
      } as Variable;

      // send event
      await service.sendVariableChangeEvent(variable, {
        type: 'update',
        previousValue: 'old value',
        currentValue: 'new value',
        path: 'path',
        secret: false,
        updateTime: 123456789,
        updatedBy: 'user',
        updatedFields: ['value'],
      });

      // check socket emit called
      expect(socket1.emit).toBeCalledWith('handleVariableChangeEvent:var1', {
        id: 'var1',
        type: 'update',
        previousValue: 'old value',
        currentValue: 'new value',
        updateTime: 123456789,
        secret: false,
        updatedBy: 'user',
        updatedFields: ['value'],
      });
    });

    it('sends to all clients', async () => {
      // register handlers
      service.registerVariableChangeEventHandler(socket1, 'client1', 'var1');
      service.registerVariableChangeEventHandler(socket2, 'client2', 'var1');

      const variable = {
        id: 'var1',
      } as Variable;

      // send event
      await service.sendVariableChangeEvent(variable, {
        type: 'update',
        previousValue: 'old value',
        currentValue: 'new value',
        path: 'path',
        secret: false,
        updateTime: 123456789,
        updatedBy: 'user',
        updatedFields: ['value'],
      });

      // check all sockets emit called
      expect(socket1.emit).toBeCalledWith('handleVariableChangeEvent:var1', {
        id: 'var1',
        type: 'update',
        previousValue: 'old value',
        currentValue: 'new value',
        updateTime: 123456789,
        updatedBy: 'user',
        secret: false,
        updatedFields: ['value'],
      });
      expect(socket2.emit).toBeCalledWith('handleVariableChangeEvent:var1', {
        id: 'var1',
        type: 'update',
        previousValue: 'old value',
        currentValue: 'new value',
        updateTime: 123456789,
        updatedBy: 'user',
        secret: false,
        updatedFields: ['value'],
      });
    });

    it('does not send event if no matching handlers', async () => {
      const variable = {
        id: 'var1',
      } as Variable;

      // send event
      await service.sendVariableChangeEvent(variable, {
        type: 'update',
        previousValue: 'old value',
        currentValue: 'new value',
        updateTime: 123456789,
        updatedBy: 'user',
        secret: false,
        path: 'path',
        updatedFields: ['value'],
      });

      // check nothing emitted
      expect(socket1.emit).not.toBeCalled();
    });

    it('sends to matching variables change handlers by path', async () => {
      const authData = {
        environment: {
          id: 'env123',
        },
        tenant: {
          id: 'tenant123',
        },
      } as AuthData;

      // register handlers
      service.registerVariablesChangeEventHandler(socket1, 'client1', authData, 'path1');
      service.registerVariablesChangeEventHandler(socket2, 'client2', authData, 'path2');

      const variable = {
        id: 'var123',
        environmentId: 'env123',
      } as Variable;

      // send event
      await service.sendVariableChangeEvent(variable, {
        type: 'update',
        previousValue: 'old value',
        currentValue: 'new value',
        updateTime: 123456789,
        updatedBy: 'user',
        secret: false,
        path: 'path1.var123',
        updatedFields: ['value'],
      });

      // check socket1 emitted
      expect(socket1.emit).toBeCalled();

      // check socket2 did not emit
      expect(socket2.emit).not.toBeCalled();
    });

    it('does not send to variables change handler for different path', async () => {
      const authData = {
        environment: {
          id: 'env123',
        },
        tenant: {
          id: 'tenant123',
        },
      } as AuthData;
      // register handler
      service.registerVariablesChangeEventHandler(socket1, 'client1', authData, 'path1');

      const variable = {
        id: 'var123',
      } as Variable;

      // send event
      await service.sendVariableChangeEvent(variable, {
        type: 'update',
        previousValue: 'old value',
        currentValue: 'new value',
        updateTime: 123456789,
        updatedBy: 'user',
        secret: false,
        path: 'path2.var123',
        updatedFields: ['value'],
      });

      // check nothing emitted
      expect(socket1.emit).not.toBeCalled();
    });
  });

  describe('registerVariablesChangeEventHandler', () => {
    it('registers new variables change handler', () => {
      const authData = {
        environment: {
          id: 'env123',
        },
        tenant: {
          id: 'tenant123',
        },
      } as AuthData;

      service.registerVariablesChangeEventHandler(socket1, 'client1', authData, 'path1');

      // @ts-ignore
      expect(service.variablesChangeHandlers['client1']['path1']).toEqual([
        {
          socket: socket1,
          authData,
        },
      ]);
    });

    it('adds socket to existing handler', () => {
      const authData = {
        environment: {
          id: 'env123',
        },
        tenant: {
          id: 'tenant123',
        },
      } as AuthData;

      service.registerVariablesChangeEventHandler(socket1, 'client1', authData, 'path1');
      service.registerVariablesChangeEventHandler(socket2, 'client1', authData, 'path1');

      // @ts-ignore
      expect(service.variablesChangeHandlers['client1']['path1']).toEqual([
        { socket: socket1, authData },
        { socket: socket2, authData },
      ]);
    });
  });
});
