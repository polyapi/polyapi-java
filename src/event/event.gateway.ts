import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import {
  AuthFunctionEventHandlerDto,
  ErrorHandlerDto,
  VariableChangeEventHandlerDto,
  VariablesChangeEventHandlerDto,
  WebhookEventHandlerDto,
} from '@poly/model';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { EventService } from 'event/event.service';
import { AuthService } from 'auth/auth.service';
import { WebhookService } from 'webhook/webhook.service';
import { VariableService } from 'variable/variable.service';
import { AuthProviderService } from 'auth-provider/auth-provider.service';
import { ApplicationService } from 'application/application.service';
import { EnvironmentService } from 'environment/environment.service';

@WebSocketGateway({ namespace: 'events' })
export class EventGateway {
  @WebSocketServer()
  private server: Server;

  private logger: Logger = new Logger(EventGateway.name);

  constructor(
    private readonly eventService: EventService,
    private readonly authService: AuthService,
    private readonly webhookService: WebhookService,
    private readonly authProviderService: AuthProviderService,
    private readonly variableService: VariableService,
    private readonly applicationService: ApplicationService,
    private readonly environmentService: EnvironmentService,
  ) {
  }

  @SubscribeMessage('registerErrorHandler')
  async registerErrorHandler(client: Socket, errorHandler: ErrorHandlerDto) {
    if (!await this.checkErrorHandler(errorHandler)) {
      return null;
    }
    const authData = await this.authService.getAuthData(errorHandler.apiKey);
    if (!authData) {
      return null;
    }

    return this.eventService.registerErrorHandler(
      client,
      authData,
      errorHandler.path,
      errorHandler.applicationIds,
      errorHandler.environmentIds,
      errorHandler.functionIds,
      errorHandler.tenant,
    );
  }

  @SubscribeMessage('unregisterErrorHandler')
  async unregisterErrorHandler(client: Socket, errorHandler: ErrorHandlerDto) {
    if (!await this.checkErrorHandler(errorHandler)) {
      return false;
    }
    if (!errorHandler.id) {
      this.logger.debug('No id provided for unregisterErrorHandler');
      return false;
    }

    this.eventService.unregisterErrorHandler(client, errorHandler.id);
  }

  @SubscribeMessage('registerWebhookEventHandler')
  async registerWebhookEventHandler(client: Socket, handler: WebhookEventHandlerDto) {
    if (!await this.checkWebhookEventHandler(handler)) {
      return false;
    }
    this.eventService.registerWebhookEventHandler(client, handler.clientID, handler.webhookHandleID);
    return true;
  }

  @SubscribeMessage('unregisterWebhookEventHandler')
  async unregisterWebhookEventHandler(client: Socket, handler: WebhookEventHandlerDto) {
    if (!await this.checkWebhookEventHandler(handler, false)) {
      return false;
    }
    this.eventService.unregisterWebhookEventHandler(client, handler.clientID, handler.webhookHandleID);
  }

  @SubscribeMessage('registerAuthFunctionEventHandler')
  async registerAuthFunctionEventHandler(client: Socket, handler: AuthFunctionEventHandlerDto) {
    if (!await this.checkAuthFunctionEventHandler(handler)) {
      return false;
    }
    return this.eventService.registerAuthFunctionEventHandler(client, handler.clientID, handler.functionId);
  }

  @SubscribeMessage('unregisterAuthFunctionEventHandler')
  async unregisterAuthFunctionEventHandler(client: Socket, webhookEventHandler: AuthFunctionEventHandlerDto) {
    if (!await this.checkAuthFunctionEventHandler(webhookEventHandler, false)) {
      return false;
    }
    this.eventService.unregisterAuthFunctionEventHandler(client, webhookEventHandler.clientID, webhookEventHandler.functionId);
  }

  @SubscribeMessage('registerVariableChangeEventHandler')
  async registerVariableChangeEventHandler(client: Socket, handler: VariableChangeEventHandlerDto) {
    if (!await this.checkVariableChangeEventHandler(handler)) {
      return false;
    }
    return this.eventService.registerVariableChangeEventHandler(client, handler.clientID, handler.variableId);
  }

  @SubscribeMessage('unregisterVariableChangeEventHandler')
  async unregisterVariableChangeEventHandler(client: Socket, handler: VariableChangeEventHandlerDto) {
    if (!await this.checkVariableChangeEventHandler(handler, false)) {
      return false;
    }
    this.eventService.unregisterVariableChangeEventHandler(client, handler.clientID, handler.variableId);
  }

  @SubscribeMessage('registerVariablesChangeEventHandler')
  async registerVariablesChangeEventHandler(client: Socket, handler: VariablesChangeEventHandlerDto) {
    if (!await this.checkVariablesChangeEventHandler(handler)) {
      return false;
    }
    const authData = await this.authService.getAuthData(handler.apiKey);
    if (!authData) {
      return false;
    }

    return this.eventService.registerVariablesChangeEventHandler(client, handler.clientID, authData, handler.path, handler.options?.type, handler.options?.secret);
  }

  @SubscribeMessage('unregisterVariablesChangeEventHandler')
  async unregisterVariablesChangeEventHandler(client: Socket, handler: VariablesChangeEventHandlerDto) {
    if (!await this.checkVariablesChangeEventHandler(handler)) {
      return false;
    }
    this.eventService.unregisterVariablesChangeEventHandler(client, handler.clientID, handler.path);
  }

  private async checkErrorHandler({ apiKey, path, applicationIds, environmentIds }: ErrorHandlerDto) {
    if (path == null) {
      this.logger.debug('Missing path.');
      return false;
    }
    if (!apiKey) {
      this.logger.debug('Missing API key.');
      return false;
    }
    const authData = await this.authService.getAuthData(apiKey);
    if (!authData) {
      this.logger.debug(`Invalid API key: ${apiKey}`);
      return false;
    }

    if (applicationIds) {
      for (const applicationId of applicationIds) {
        const application = await this.applicationService.findById(applicationId);
        if (!application) {
          this.logger.debug(`Invalid application ID: ${applicationId}`);
          return false;
        }
        if (application.tenantId !== authData.tenant.id) {
          this.logger.debug(`No access to application ${applicationId} from another tenant`);
          return false;
        }
      }
    }
    if (environmentIds) {
      for (const environmentId of environmentIds) {
        const environment = await this.environmentService.findById(environmentId);
        if (!environment) {
          this.logger.debug(`Invalid environment ID: ${environmentId}`);
          return false;
        }
        if (environment.tenantId !== authData.tenant.id) {
          this.logger.debug(`No access to environment ${environmentId} from another tenant`);
          return false;
        }
      }
    }

    return true;
  }

  private async checkWebhookEventHandler({ clientID, webhookHandleID, apiKey }: WebhookEventHandlerDto, checkAccess = true) {
    if (!clientID) {
      this.logger.debug('Missing client ID.');
      return false;
    }
    if (!webhookHandleID) {
      this.logger.debug('Missing webhook handle ID.');
      return false;
    }
    if (!apiKey) {
      this.logger.debug('Missing API key.');
      return false;
    }
    const authData = await this.authService.getAuthData(apiKey);
    if (!authData) {
      this.logger.debug(`Invalid API key: ${apiKey}`);
      return false;
    }

    if (checkAccess) {
      const webhookHandle = await this.webhookService.findWebhookHandle(webhookHandleID);
      if (!webhookHandle) {
        this.logger.debug(`Invalid webhook handle ID: ${webhookHandleID}`);
        return false;
      }
      if (!await this.authService.hasEnvironmentEntityAccess(webhookHandle, authData, true)) {
        this.logger.debug(`Access denied for webhook handle ID: ${webhookHandleID}`);
        return false;
      }
    }

    return true;
  }

  private async checkAuthFunctionEventHandler({ clientID, functionId, apiKey }: AuthFunctionEventHandlerDto, checkAccess = true) {
    if (!clientID) {
      this.logger.debug('Missing client ID.');
      return false;
    }
    if (!functionId) {
      this.logger.debug('Missing function ID.');
      return false;
    }
    if (!apiKey) {
      this.logger.debug('Missing API key.');
      return false;
    }
    const authData = await this.authService.getAuthData(apiKey);
    if (!authData) {
      this.logger.debug(`Invalid API key: ${apiKey}`);
      return false;
    }

    if (checkAccess) {
      const authProvider = await this.authProviderService.getAuthProvider(functionId);
      if (!authProvider) {
        this.logger.debug(`Invalid function ID: ${functionId}`);
        return false;
      }
      if (!await this.authService.hasEnvironmentEntityAccess(authProvider, authData, true)) {
        this.logger.debug(`Access denied for function ID: ${functionId}`);
        return false;
      }
    }

    return true;
  }

  private async checkVariableChangeEventHandler({ clientID, variableId, apiKey }: VariableChangeEventHandlerDto, checkAccess = true) {
    if (!clientID) {
      this.logger.debug('Missing client ID.');
      return false;
    }
    if (!variableId) {
      this.logger.debug('Missing variable ID.');
      return false;
    }
    if (!apiKey) {
      this.logger.debug('Missing API key.');
      return false;
    }
    const authData = await this.authService.getAuthData(apiKey);
    if (!authData) {
      this.logger.debug(`Invalid API key: ${apiKey}`);
      return false;
    }

    if (checkAccess) {
      const variable = await this.variableService.findById(variableId);
      if (!variable) {
        this.logger.debug(`Invalid variable ID: ${variableId}`);
        return false;
      }
      if (!await this.authService.hasEnvironmentEntityAccess(variable, authData, true)) {
        this.logger.debug(`Access denied for variable ID: ${variableId}`);
        return false;
      }
    }

    return true;
  }

  private async checkVariablesChangeEventHandler({ clientID, path, apiKey }: VariablesChangeEventHandlerDto) {
    if (!clientID) {
      this.logger.debug('Missing client ID.');
      return false;
    }
    if (path == null) {
      this.logger.debug('Missing path.');
      return false;
    }
    if (!apiKey) {
      this.logger.debug('Missing API key.');
      return false;
    }
    const authData = await this.authService.getAuthData(apiKey);
    if (!authData) {
      this.logger.debug(`Invalid API key: ${apiKey}`);
      return false;
    }
    return true;
  }
}
