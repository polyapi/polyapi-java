import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { ErrorEvent, VariableChangeEvent } from '@poly/model';
import { AxiosError } from 'axios';

type ClientID = string;
type Path = string;
type WebhookHandleID = string;
type AuthFunctionID = string;
type VariableID = string;

@Injectable()
export class EventService {
  private logger: Logger = new Logger(EventService.name);
  private readonly errorHandlers: Record<ClientID, Record<Path, Socket[]>> = {};
  private readonly webhookEventHandlers: Record<ClientID, Record<WebhookHandleID, Socket[]>> = {};
  private readonly authFunctionHandlers: Record<ClientID, Record<AuthFunctionID, Socket[]>> = {};
  private readonly variableChangeHandlers: Record<ClientID, Record<VariableID, Socket[]>> = {};

  registerErrorHandler(client: Socket, clientID: string, path: string) {
    this.logger.debug(`Registering error handler: ${clientID} '${path}'`);
    if (!this.errorHandlers[clientID]) {
      this.errorHandlers[clientID] = {};
    }
    if (!this.errorHandlers[clientID][path]) {
      this.errorHandlers[clientID][path] = [];
    }
    this.errorHandlers[clientID][path].push(client);

    client.on('disconnect', () => {
      this.logger.debug(`Client for error handler disconnected: ${clientID} '${path}'`);
      this.unregisterErrorHandler(client, clientID, path);
    });
  }

  unregisterErrorHandler(client: Socket, clientID: string, path: string) {
    this.logger.debug(`Unregistering error handler: ${clientID} '${path}'`);
    if (!this.errorHandlers[clientID]?.[path]) {
      return;
    }
    this.errorHandlers[clientID][path] = this.errorHandlers[clientID][path].filter(socket => socket.id !== client.id);
  }

  sendErrorEvent(clientID: string | null, functionPath: string, error: ErrorEvent): boolean {
    if (!clientID) {
      return false;
    }

    const clientErrorHandler = this.errorHandlers[clientID];
    if (!clientErrorHandler) {
      return false;
    }
    const handlers = Object.keys(clientErrorHandler)
      .filter(handlerPath => functionPath === handlerPath || functionPath.startsWith(`${handlerPath}.`) || functionPath.endsWith(`.${handlerPath}`));

    handlers
      .forEach(handlerPath => {
        this.logger.debug(`Sending error event: ${clientID} '${functionPath}'->'${handlerPath}'`, error);
        clientErrorHandler[handlerPath].forEach(socket => socket.emit(`handleError:${handlerPath}`, error));
      });

    return handlers.length > 0;
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

  registerWebhookEventHandler(client: Socket, clientID: string, webhookHandleID: string) {
    this.logger.debug(`Registering webhook handler for webhook handle ${webhookHandleID} on ${clientID}`);
    if (!this.webhookEventHandlers[clientID]) {
      this.webhookEventHandlers[clientID] = {};
    }
    if (!this.webhookEventHandlers[clientID][webhookHandleID]) {
      this.webhookEventHandlers[clientID][webhookHandleID] = [];
    }
    this.webhookEventHandlers[clientID][webhookHandleID].push(client);

    client.on('disconnect', () => {
      this.logger.debug(`Client for webhook event handler disconnected: ${clientID} '${webhookHandleID}'`);
      this.unregisterWebhookEventHandler(client, clientID, webhookHandleID);
    });
  }

  unregisterWebhookEventHandler(client: Socket, clientID: string, webhookHandleID: string) {
    this.logger.debug(`Unregistering webhook event handler: '${webhookHandleID}' on ${clientID}`);
    if (!this.webhookEventHandlers[clientID]?.[webhookHandleID]) {
      return;
    }

    this.webhookEventHandlers[clientID][webhookHandleID] = this.webhookEventHandlers[clientID][webhookHandleID]
      .filter(socket => socket.id !== client.id);
  }

  sendWebhookEvent(webhookHandleID: string, eventPayload: any) {
    this.logger.debug(`Sending webhook event: '${webhookHandleID}'`, eventPayload);

    Object.values(this.webhookEventHandlers).forEach(clientHandlers => {
      if (!clientHandlers[webhookHandleID]) {
        return;
      }
      clientHandlers[webhookHandleID].forEach(socket => socket.emit(`handleWebhookEvent:${webhookHandleID}`, eventPayload));
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

  sendVariableChangeEvent(variableId: string, event: VariableChangeEvent) {
    this.logger.debug(`Sending variable update event: '${variableId}'=${event.currentValue}`);

    const handlers = Object.values(this.variableChangeHandlers);
    handlers.forEach(clientHandlers => {
      if (!clientHandlers?.[variableId]) {
        return;
      }
      clientHandlers[variableId].forEach(socket => {
        this.logger.debug(`Sending variable event: '${variableId}'`, event);
        socket.emit(`handleVariableChangeEvent:${variableId}`, event);
      });
    });
  }
}
