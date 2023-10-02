import {
  All,
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { WebhookHandle } from '@prisma/client';
import { WebhookService } from 'webhook/webhook.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import {
  CreateWebhookHandleDto,
  Permission,
  Role,
  UpdateWebhookHandleDto,
  Visibility,
  WebhookHandlePublicDto,
} from '@poly/model';
import { AuthRequest } from 'common/types';
import { AuthService } from 'auth/auth.service';
import { CommonService } from 'common/common.service';
import { TriggerResponse } from 'trigger/trigger.service';
import { EnvironmentService } from 'environment/environment.service';
import { PerfLogInfoProvider } from 'statistics/perf-log-info-provider';
import { PerfLogInterceptor } from 'statistics/perf-log-interceptor';
import { PerfLogType } from 'statistics/perf-log-type';
import { PerfLog } from 'statistics/perf-log.decorator';

@ApiSecurity('PolyApiKey')
@Controller('webhooks')
@UseInterceptors(PerfLogInterceptor)
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  public constructor(
    private readonly webhookService: WebhookService,
    private readonly authService: AuthService,
    private readonly commonService: CommonService,
    private readonly environmentService: EnvironmentService,
    private readonly perfLogInfoProvider: PerfLogInfoProvider,
  ) {
  }

  @UseGuards(PolyAuthGuard)
  @Get()
  public async getWebhookHandles(@Req() req: AuthRequest) {
    const environment = req.user.environment;
    const webhookHandles = await this.webhookService.getWebhookHandles(environment.id);
    return webhookHandles.map((handle) => this.webhookService.toDto(handle, environment));
  }

  @UseGuards(PolyAuthGuard)
  @Get('/public')
  public async getPublicWebhookHandles(@Req() req: AuthRequest): Promise<WebhookHandlePublicDto[]> {
    const { tenant, environment, user } = req.user;
    const webhookHandles = await this.webhookService.getPublicWebhookHandles(tenant, environment, user?.role === Role.Admin);
    return webhookHandles.map((handle) => this.webhookService.toPublicDto(handle, environment));
  }

  @UseGuards(PolyAuthGuard)
  @Get('/public/:id')
  async getPublicClientFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<WebhookHandlePublicDto> {
    const { tenant, environment } = req.user;
    const webhookHandle = await this.webhookService.findPublicWebhookHandle(tenant, environment, id);
    if (webhookHandle === null) {
      throw new NotFoundException(`Public webhook handle with ID ${id} not found.`);
    }

    return this.webhookService.toPublicDto(webhookHandle, environment);
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id')
  public async getWebhookHandle(@Req() req: AuthRequest, @Param('id') id: string) {
    const webhookHandle = await this.findWebhookHandle(id);

    await this.authService.checkEnvironmentEntityAccess(webhookHandle, req.user, false, Permission.Teach);

    return this.webhookService.toDto(webhookHandle, req.user.environment);
  }

  @UseGuards(PolyAuthGuard)
  @Post()
  public async createWebhookHandle(@Req() req: AuthRequest, @Body() createWebhookHandle: CreateWebhookHandleDto) {
    const {
      context = '',
      name,
      eventPayload = null,
      eventPayloadTypeSchema = null,
      description = '',
      visibility,
      responsePayload,
      responseHeaders,
      responseStatus,
      subpath,
      method,
      securityFunctions = [],
    } = createWebhookHandle;

    await this.authService.checkPermissions(req.user, Permission.Teach);

    if (method && !subpath) {
      throw new BadRequestException('subpath is required if method is set');
    }

    if (!eventPayload && !eventPayloadTypeSchema) {
      throw new BadRequestException('eventPayload or eventPayloadTypeSchema is required');
    }

    const webhookHandle = await this.webhookService.createOrUpdateWebhookHandle(
      req.user.environment,
      context,
      name,
      eventPayload,
      eventPayloadTypeSchema,
      description,
      visibility,
      responsePayload,
      responseHeaders,
      responseStatus,
      subpath,
      method,
      securityFunctions,
    );
    return this.webhookService.toDto(webhookHandle, req.user.environment);
  }

  @Patch(':id')
  @UseGuards(PolyAuthGuard)
  public async updateWebhookHandle(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() updateWebhookHandleDto: UpdateWebhookHandleDto,
  ) {
    const {
      context = null,
      name = null,
      description = null,
      visibility = null,
      eventPayload,
      eventPayloadType,
      eventPayloadTypeSchema,
      responsePayload,
      responseHeaders,
      responseStatus,
      subpath,
      method,
      securityFunctions,
      enabled,
    } = updateWebhookHandleDto;

    this.commonService.checkVisibilityAllowed(req.user.tenant, visibility);

    const webhookHandle = await this.findWebhookHandle(id);

    if ((method && !subpath && !webhookHandle.subpath) || (subpath === null && method !== null && webhookHandle.method)) {
      throw new BadRequestException('subpath is required if method is set');
    }
    if (enabled !== undefined) {
      if (req.user.user?.role !== Role.SuperAdmin) {
        throw new BadRequestException('You do not have permission to enable/disable webhooks.');
      }
    }
    if (eventPayloadType === 'object' && !eventPayloadTypeSchema) {
      throw new BadRequestException('eventPayloadTypeSchema is required if eventPayloadType is object');
    }
    if (eventPayloadTypeSchema && (eventPayloadType && eventPayloadType !== 'object')) {
      throw new BadRequestException('eventPayloadTypeSchema is only allowed if eventPayloadType is object');
    }
    if (eventPayload && eventPayloadType) {
      throw new BadRequestException('eventPayload and eventPayloadType cannot be set at the same time');
    }
    if (eventPayload && eventPayloadTypeSchema) {
      throw new BadRequestException('eventPayload and eventPayloadTypeSchema cannot be set at the same time');
    }

    await this.authService.checkEnvironmentEntityAccess(webhookHandle, req.user, false, Permission.Teach);

    return this.webhookService.toDto(
      await this.webhookService.updateWebhookHandle(
        webhookHandle,
        context,
        name,
        description,
        visibility,
        eventPayload,
        eventPayloadType,
        eventPayloadTypeSchema,
        responsePayload,
        responseHeaders,
        responseStatus,
        subpath,
        method,
        securityFunctions,
        enabled,
      ),
      req.user.environment,
    );
  }

  @PerfLog(PerfLogType.WebhookTrigger)
  @Post(':id')
  public async triggerWebhookHandle(@Req() req: Request, @Res() res: Response, @Param('id') id: string, @Body() payload: any, @Headers() headers: Record<string, any>) {
    const webhookHandle = await this.findWebhookHandle(id);
    if (webhookHandle.subpath) {
      throw new NotFoundException();
    }
    if (!webhookHandle.enabled) {
      this.throwWebhookDisabledException();
    }

    const executionEnvironment = await this.resolveExecutionEnvironment(webhookHandle, req);
    const response = await this.webhookService.triggerWebhookHandle(webhookHandle, executionEnvironment, payload, headers);

    this.perfLogInfoProvider.data = {
      id: webhookHandle.id,
    };

    this.sendWebhookResponse(res, webhookHandle, response);
  }

  @PerfLog(PerfLogType.WebhookTrigger)
  @All(':id/:subpath*')
  public async triggerWebhookHandleWithSubpath(@Req() req: Request, @Res() res: Response, @Param('id') id: string, @Body() payload: any, @Headers() headers: Record<string, any>) {
    const webhookHandle = await this.findWebhookHandle(id);
    if ((!webhookHandle.method && req.method !== 'POST') || (webhookHandle.method && webhookHandle.method !== req.method)) {
      throw new NotFoundException();
    }
    if (!webhookHandle.enabled) {
      this.throwWebhookDisabledException();
    }

    const subpath = this.resolveSubpath(req, webhookHandle);
    const executionEnvironment = await this.resolveExecutionEnvironment(webhookHandle, req);
    const response = await this.webhookService.triggerWebhookHandle(webhookHandle, executionEnvironment, payload, headers, subpath);

    this.perfLogInfoProvider.data = {
      id: webhookHandle.id,
    };

    this.sendWebhookResponse(res, webhookHandle, response);
  }

  private sendWebhookResponse(res: Response, webhookHandle: WebhookHandle, webhookResponse: TriggerResponse | null) {
    if (webhookHandle.responseHeaders) {
      const headers = JSON.parse(webhookHandle.responseHeaders);
      Object.keys(headers).forEach(key => {
        res.setHeader(key, headers[key]);
      });
    }

    res.status(webhookHandle.responseStatus || webhookResponse?.statusCode || 200)
      .send(webhookResponse?.data || (webhookHandle.responsePayload ? JSON.parse(webhookHandle.responsePayload) : undefined));
  }

  @Delete(':id')
  @UseGuards(PolyAuthGuard)
  public async deleteWebhookHandle(@Req() req: AuthRequest, @Param('id') id: string) {
    const webhookHandle = await this.findWebhookHandle(id);

    await this.authService.checkEnvironmentEntityAccess(webhookHandle, req.user, false, Permission.Teach);

    await this.webhookService.deleteWebhookHandle(id);
  }

  @UseGuards(PolyAuthGuard)
  @Put(':context/:name')
  public async registerWebhookContextFunction(
    @Req() req: AuthRequest,
    @Param('context') context: string,
    @Param('name') name: string,
    @Body() payload: any,
  ) {
    await this.authService.checkPermissions(req.user, Permission.Teach);

    const webhookHandle = await this.webhookService.createOrUpdateWebhookHandle(
      req.user.environment,
      context,
      name,
      payload,
      null,
      '',
    );
    return this.webhookService.toDto(webhookHandle, req.user.environment);
  }

  @UseGuards(PolyAuthGuard)
  @Put(':name')
  public async registerWebhookFunction(@Req() req: AuthRequest, @Param('name') name: string, @Body() payload: any) {
    await this.authService.checkPermissions(req.user, Permission.Teach);

    const webhookHandle = await this.webhookService.createOrUpdateWebhookHandle(
      req.user.environment,
      '',
      name,
      payload,
      null,
      '',
    );
    return this.webhookService.toDto(webhookHandle, req.user.environment);
  }

  private async findWebhookHandle(id: string) {
    const webhookHandle = await this.webhookService.findWebhookHandle(id);
    if (!webhookHandle) {
      throw new NotFoundException();
    }

    return webhookHandle;
  }

  private throwWebhookDisabledException() {
    throw new BadRequestException('Webhook is disabled by System Administrator and cannot be used.');
  }

  private async resolveExecutionEnvironment(webhookHandle: WebhookHandle, req: Request) {
    if (webhookHandle.visibility !== Visibility.Environment) {
      const environment = await this.environmentService.findByHost(req.hostname);
      if (!environment) {
        throw new NotFoundException();
      }

      return environment;
    }

    return null;
  }

  private resolveSubpath(req: Request, webhookHandle: WebhookHandle) {
    const subpath = req.url.split('/').slice(3).join('/');

    if (!webhookHandle.subpath) {
      throw new NotFoundException();
    }
    let subpathTemplate = webhookHandle.subpath;
    if (subpathTemplate.startsWith('/')) {
      subpathTemplate = subpathTemplate.slice(1);
    }

    const subpathRegex = new RegExp(`^${subpathTemplate.replace(/\?/g, '\\?').replace(/\{[^}]+}/g, '[^/]+')}$`);
    if (!subpathRegex.test(subpath)) {
      throw new NotFoundException();
    }

    return subpath;
  }
}
