import crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { ErrorEvent, VariableChangeEvent, VariableChangeEventType, Visibility } from '@poly/model';
import { AxiosError } from 'axios';
import { Environment, Variable } from '@prisma/client';
import { AuthService } from 'auth/auth.service';
import { AuthData } from 'common/types';

type ClientID = string;
type Path = string;
type ErrorHandler = {
  id: string;
  path: string;
  socket: Socket;
  authData: AuthData;
  applicationIds?: string[];
  environmentIds?: string[];
  functionIds?: string[];
  tenant?: boolean;
}
type WebhookHandleID = string;
type WebhookHandleListener = {
  clientID: string;
  socket: Socket;
  authData: AuthData;
}
type AuthFunctionID = string;
type VariableID = string;
type VariableSocketListener = {
  socket: Socket;
  authData: AuthData;
  type?: VariableChangeEventType;
  secret?: boolean;
}

@Injectable()
export class EventService {
  private logger: Logger = new Logger(EventService.name);
  private errorHandlers: ErrorHandler[] = [];
  private readonly webhookHandleListeners: Record<WebhookHandleID, WebhookHandleListener[]> = {};
  // TODO: future: use flat array structure for this
  private readonly authFunctionHandlers: Record<ClientID, Record<AuthFunctionID, Socket[]>> = {};
  private readonly variableChangeHandlers: Record<ClientID, Record<VariableID, Socket[]>> = {};
  private readonly variablesChangeHandlers: Record<ClientID, Record<Path, VariableSocketListener[]>> = {};

  constructor(
    private readonly authService: AuthService,
  ) {
  }

  registerErrorHandler(
    socket: Socket,
    authData: AuthData,
    path: string,
    applicationIds?: string[],
    environmentIds?: string[],
    functionIds?: string[],
    tenant?: boolean,
  ) {
    const id = crypto.randomUUID();
    this.logger.debug(`Registering error handler: ${socket.id} '${path}', applicationIds: ${applicationIds}, environmentIds: ${environmentIds}, functionIds: ${functionIds}, tenant: ${tenant} with ID=${id}}`);
    this.errorHandlers.push({
      id,
      socket,
      path,
      authData,
      applicationIds,
      environmentIds,
      functionIds,
      tenant,
    });

    socket.on('disconnect', () => {
      this.logger.debug(`Client for error handler '${id}' disconnected. Removing handler...`);
      this.errorHandlers = this.errorHandlers.filter(handler => handler.id !== id);
    });

    return id;
  }

  unregisterErrorHandler(socket: Socket, handlerId: string) {
    this.logger.debug(`Unregistering error handler: ${socket.id} '${handlerId}'`);
    this.errorHandlers = this.errorHandlers.filter(handler => handler.id !== handlerId);
  }

  async sendErrorEvent(
    id: string,
    environmentId: string,
    tenantId: string,
    visibility: Visibility,
    applicationId: string | null,
    userId: string | null,
    path: string,
    error: ErrorEvent,
  ): Promise<boolean> {
    const handlerEvent = {
      ...error,
      functionId: id,
      applicationId,
      userId,
    };
    const errorHandlersOnPath = this.errorHandlers
      .filter(this.filterByPath(path, handler => handler.path));
    const tenantHandlers = errorHandlersOnPath
      .filter(handler => handler.tenant === true && tenantId === handler.authData.tenant.id);
    const environmentHandlers = errorHandlersOnPath
      .filter(handler => handler.environmentIds?.includes(environmentId));
    const applicationHandlers = errorHandlersOnPath
      .filter(handler => applicationId && handler.applicationIds?.includes(applicationId));
    const functionHandlers = errorHandlersOnPath
      .filter(handler => handler.functionIds?.includes(id));
    const defaultHandlers = errorHandlersOnPath
      .filter(handler => handler.functionIds === undefined && handler.applicationIds === undefined && handler.environmentIds === undefined && handler.tenant === undefined)
      .filter(handler => !userId || handler.authData.user?.id === userId)
      .filter(handler => !applicationId || handler.authData.application?.id === applicationId);
    const allHandlers = [
      ...tenantHandlers,
      ...environmentHandlers,
      ...applicationHandlers,
      ...functionHandlers,
      ...defaultHandlers,
    ];
    if (allHandlers.length === 0) {
      return false;
    }

    const sentInfos = await Promise.all(allHandlers.map(async ({ id, authData, socket }) => {
      // currently allowing Tenant access by default
      if (visibility !== Visibility.Public && authData.tenant.id !== tenantId) {
        return false;
      }

      this.logger.debug(`Sending error event for path: '${path}' to '${id}'`, handlerEvent);
      socket.emit(`handleError:${id}`, handlerEvent);
      return true;
    }));

    // counted only if default handlers are used
    return defaultHandlers.length > 0 && sentInfos.some(sent => sent);
  }

  getEventError(error: AxiosError): ErrorEvent {
    if (error.response) {
      return {
        message: error.message,
        data: error.response.data,
        status: error.response.status,
        statusText: error.response.statusText,
      };
    } else {
      return {
        message: error.message,
      };
    }
  }

  registerWebhookEventHandler(client: Socket, clientID: string, webhookHandleID: string, authData: AuthData) {
    this.logger.debug(`Registering webhook handler for webhook handle ${webhookHandleID} on ${clientID}`);
    if (!this.webhookHandleListeners[webhookHandleID]) {
      this.webhookHandleListeners[webhookHandleID] = [];
    }
    this.webhookHandleListeners[webhookHandleID].push({
      socket: client,
      clientID,
      authData,
    });

    client.on('disconnect', () => {
      this.logger.debug(`Client for webhook event handler disconnected: ${clientID} '${webhookHandleID}'`);
      this.unregisterWebhookEventHandler(client, clientID, webhookHandleID);
    });
  }

  unregisterWebhookEventHandler(client: Socket, clientID: string, webhookHandleID: string) {
    this.logger.debug(`Unregistering webhook event handler: '${webhookHandleID}' on ${clientID}`);
    if (!this.webhookHandleListeners[webhookHandleID]) {
      return;
    }

    this.webhookHandleListeners[webhookHandleID] = this.webhookHandleListeners[webhookHandleID]
      .filter(listener => listener.clientID !== clientID);
  }

  sendWebhookEvent(webhookHandleID: string, executionEnvironment: Environment | null, eventPayload: any, eventHeaders: Record<string, any>, subpathParams: Record<string, string>) {
    this.logger.debug(`Sending webhook event: '${webhookHandleID}'`, eventPayload);

    this.webhookHandleListeners[webhookHandleID]?.forEach(({ socket, authData }) => {
      if (executionEnvironment && authData.environment.id !== executionEnvironment.id) {
        return;
      }

      socket.emit(`handleWebhookEvent:${webhookHandleID}`, {
        body: eventPayload,
        headers: eventHeaders,
        params: subpathParams,
      });
    });
  }

  registerAuthFunctionEventHandler(client: Socket, clientID: string, authFunctionId: string): boolean {
    this.logger.debug(`Registering handler for auth function ${authFunctionId} on ${clientID}`);
    if (!this.authFunctionHandlers[clientID]) {
      this.authFunctionHandlers[clientID] = {};
    }
    let handlers = this.authFunctionHandlers[clientID][authFunctionId];
    if (!handlers) {
      this.authFunctionHandlers[clientID][authFunctionId] = handlers = [];
    }
    if (handlers.some(socket => socket.id === client.id)) {
      return false;
    }
    handlers.push(client);

    client.on('disconnect', () => {
      this.logger.debug(`Client for auth function handler disconnected: ${clientID} '${authFunctionId}'`);
      this.unregisterAuthFunctionEventHandler(client, clientID, authFunctionId);
    });

    return true;
  }

  unregisterAuthFunctionEventHandler(client: Socket, clientID: string, authFunctionId: string) {
    this.logger.debug(`Unregistering auth function handler: '${authFunctionId}' on ${clientID}`);
    if (!this.authFunctionHandlers[clientID]?.[authFunctionId]) {
      return;
    }

    this.authFunctionHandlers[clientID][authFunctionId] = this.authFunctionHandlers[clientID][authFunctionId]
      .filter(socket => socket.id !== client.id);
  }

  sendAuthFunctionEvent(authFunctionId: string, clientID: string | null, eventPayload: any) {
    this.logger.debug(`Sending auth function event: '${authFunctionId}'`, eventPayload);

    const handlers = clientID ? [this.authFunctionHandlers[clientID]] : Object.values(this.authFunctionHandlers);
    handlers.forEach(clientHandlers => {
      if (!clientHandlers?.[authFunctionId]) {
        return;
      }
      clientHandlers[authFunctionId].forEach(socket => {
        this.logger.debug(`Sending auth function event: '${authFunctionId}'`, eventPayload);
        socket.emit(`handleAuthFunctionEvent:${authFunctionId}`, eventPayload);
      });
    });
  }

  registerVariableChangeEventHandler(client: Socket, clientID: string, variableId: string): boolean {
    this.logger.debug(`Registering handler for variable ${variableId} on ${clientID}`);
    if (!this.variableChangeHandlers[clientID]) {
      this.variableChangeHandlers[clientID] = {};
    }
    let handlers = this.variableChangeHandlers[clientID][variableId];
    if (!handlers) {
      this.variableChangeHandlers[clientID][variableId] = handlers = [];
    }
    if (handlers.some(socket => socket.id === client.id)) {
      return false;
    }
    handlers.push(client);

    client.on('disconnect', () => {
      this.logger.debug(`Client for variable handler disconnected: ${clientID} '${variableId}'`);
      this.unregisterVariableChangeEventHandler(client, clientID, variableId);
    });

    return true;
  }

  unregisterVariableChangeEventHandler(client: Socket, clientID: string, variableId: string) {
    this.logger.debug(`Unregistering variable handler: '${variableId}' on ${clientID}`);
    if (!this.variableChangeHandlers[clientID]?.[variableId]) {
      return;
    }

    this.variableChangeHandlers[clientID][variableId] = this.variableChangeHandlers[clientID][variableId]
      .filter(socket => socket.id !== client.id);
  }

  registerVariablesChangeEventHandler(
    client: Socket,
    clientID: string,
    authData: AuthData,
    path: string,
    type?: VariableChangeEventType,
    secret?: boolean,
  ): boolean {
    this.logger.debug(`Registering handler for variables on path ${path} on ${clientID}`);
    if (!this.variablesChangeHandlers[clientID]) {
      this.variablesChangeHandlers[clientID] = {};
    }
    let handlers = this.variablesChangeHandlers[clientID][path];
    if (!handlers) {
      this.variablesChangeHandlers[clientID][path] = handlers = [];
    }
    if (handlers.some(filterSocket => filterSocket.socket.id === client.id)) {
      return false;
    }
    handlers.push({
      socket: client,
      authData,
      type,
      secret,
    });

    client.on('disconnect', () => {
      this.logger.debug(`Client for variable handler disconnected: ${clientID} '${path}'`);
      this.unregisterVariablesChangeEventHandler(client, clientID, path);
    });

    return true;
  }

  unregisterVariablesChangeEventHandler(client: Socket, clientID: string, path: string) {
    this.logger.debug(`Unregistering variable handler: '${path}' on ${clientID}`);
    if (!this.variableChangeHandlers[clientID]?.[path]) {
      return;
    }

    this.variableChangeHandlers[clientID][path] = this.variableChangeHandlers[clientID][path]
      .filter(socket => socket.id !== client.id);
  }

  async sendVariableChangeEvent(variable: Variable, event: VariableChangeEvent) {
    this.logger.debug(`Sending variable update event: '${variable.id}'=${event.currentValue}`);

    const handlerEvent = {
      id: variable.id,
      type: event.type,
      secret: event.secret,
      previousValue: event.previousValue,
      currentValue: event.currentValue,
      updateTime: event.updateTime,
      updatedBy: event.updatedBy,
      updatedFields: event.updatedFields,
    };

    const handlers = Object.values(this.variableChangeHandlers);
    handlers.forEach(clientHandlers => {
      if (!clientHandlers?.[variable.id]) {
        return;
      }
      clientHandlers[variable.id].forEach(socket => {
        this.logger.debug(`Sending variable event: '${variable.id}'`, handlerEvent);
        socket.emit(`handleVariableChangeEvent:${variable.id}`, handlerEvent);
      });
    });

    const pathHandlers = Object.values(this.variablesChangeHandlers);
    for (const pathHandler of pathHandlers) {
      const paths = Object.keys(pathHandler)
        .filter(this.filterByPath(event.path));

      for (const path of paths) {
        const listeners = pathHandler[path]
          .filter(data => data.type === undefined || data.type === event.type)
          .filter(data => data.secret === undefined || data.secret === event.secret);

        await Promise.all(listeners.map(async ({ authData, socket }) => {
          if (!await this.authService.hasEnvironmentEntityAccess(variable, authData, true)) {
            return;
          }

          this.logger.debug(`Sending variable event for path: '${path}'`, handlerEvent);
          socket.emit(`handleVariablesChangeEvent:${path}`, handlerEvent);
        }));
      }
    }
  }

  private filterByPath(path: string, mapToPath: (handler: any) => Path = handler => handler) {
    return handler => {
      const handlerPath = mapToPath(handler);
      return handlerPath === '' || path === handlerPath || path.startsWith(`${handlerPath}.`) || path.endsWith(`.${handlerPath}`);
    };
  }
}
