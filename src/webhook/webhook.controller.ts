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
} from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { WebhookHandle } from '@prisma/client';
import { WebhookService } from 'webhook/webhook.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { CreateWebhookHandleDto, Permission, Role, UpdateWebhookHandleDto, WebhookHandlePublicDto } from '@poly/model';
import { AuthRequest } from 'common/types';
import { AuthService } from 'auth/auth.service';
import { CommonService } from 'common/common.service';
import { TriggerResponse } from 'trigger/trigger.service';

@ApiSecurity('PolyApiKey')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  public constructor(
    private readonly webhookService: WebhookService,
    private readonly authService: AuthService,
    private readonly commonService: CommonService,
  ) {
  }

  @UseGuards(PolyAuthGuard)
  @Get()
  public async getWebhookHandles(@Req() req: AuthRequest) {
    const webhookHandles = await this.webhookService.getWebhookHandles(req.user.environment.id);
    return webhookHandles.map((handle) => this.webhookService.toDto(handle));
  }

  @UseGuards(PolyAuthGuard)
  @Get('/public')
  public async getPublicWebhookHandles(@Req() req: AuthRequest): Promise<WebhookHandlePublicDto[]> {
    const { tenant, environment, user } = req.user;
    const webhookHandles = await this.webhookService.getPublicWebhookHandles(tenant, environment, user?.role === Role.Admin);
    return webhookHandles.map((handle) => this.webhookService.toPublicDto(handle));
  }

  @UseGuards(PolyAuthGuard)
  @Get('/public/:id')
  async getPublicClientFunction(@Req() req: AuthRequest, @Param('id') id: string): Promise<WebhookHandlePublicDto> {
    const { tenant, environment } = req.user;
    const webhookHandle = await this.webhookService.findPublicWebhookHandle(tenant, environment, id);
    if (webhookHandle === null) {
      throw new NotFoundException(`Public webhook handle with ID ${id} not found.`);
    }

    return this.webhookService.toPublicDto(webhookHandle);
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id')
  public async getWebhookHandle(@Req() req: AuthRequest, @Param('id') id: string) {
    const webhookHandle = await this.findWebhookHandle(id);

    await this.authService.checkEnvironmentEntityAccess(webhookHandle, req.user, false, Permission.Teach);

    return this.webhookService.toDto(webhookHandle);
  }

  @UseGuards(PolyAuthGuard)
  @Post()
  public async createWebhookHandle(@Req() req: AuthRequest, @Body() createWebhookHandle: CreateWebhookHandleDto) {
    const {
      context = '',
      name,
      eventPayload,
      description = '',
      visibility,
      responsePayload,
      responseHeaders,
      responseStatus,
      subpath,
      method,
      securityFunctionIds = [],
    } = createWebhookHandle;

    await this.authService.checkPermissions(req.user, Permission.Teach);

    if (method && !subpath) {
      throw new BadRequestException('subpath is required if method is set');
    }

    const webhookHandle = await this.webhookService.createOrUpdateWebhookHandle(
      req.user.environment,
      context,
      name,
      eventPayload,
      description,
      visibility,
      responsePayload,
      responseHeaders,
      responseStatus,
      subpath,
      method,
      securityFunctionIds,
    );
    return this.webhookService.toDto(webhookHandle);
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
      responsePayload,
      responseHeaders,
      responseStatus,
      subpath,
      method,
      securityFunctionIds,
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

    await this.authService.checkEnvironmentEntityAccess(webhookHandle, req.user, false, Permission.Teach);

    return this.webhookService.toDto(
      await this.webhookService.updateWebhookHandle(
        webhookHandle,
        context,
        name,
        description,
        visibility,
        eventPayload,
        responsePayload,
        responseHeaders,
        responseStatus,
        subpath,
        method,
        securityFunctionIds,
        enabled,
      ),
    );
  }

  @Post(':id')
  public async triggerWebhookHandle(@Res() res: Response, @Param('id') id: string, @Body() payload: any, @Headers() headers: Record<string, any>) {
    const webhookHandle = await this.findWebhookHandle(id);
    if (webhookHandle.subpath) {
      throw new NotFoundException();
    }
    if (!webhookHandle.enabled) {
      this.throwWebhookDisabledException();
    }

    const response = await this.webhookService.triggerWebhookHandle(webhookHandle, payload, headers);

    this.sendWebhookResponse(res, webhookHandle, response);
  }

  @All(':id/:subpath*')
  public async triggerWebhookHandleWithSubpath(@Req() req: Request, @Res() res: Response, @Param('id') id: string, @Body() payload: any, @Headers() headers: Record<string, any>) {
    const webhookHandle = await this.findWebhookHandle(id);
    if ((!webhookHandle.method && req.method !== 'POST') || (webhookHandle.method && webhookHandle.method !== req.method)) {
      throw new NotFoundException();
    }
    if (!webhookHandle.enabled) {
      this.throwWebhookDisabledException();
    }

    const subpath = req.url.split('/').slice(3).join('/');
    const response = await this.webhookService.triggerWebhookHandle(webhookHandle, payload, headers, subpath);

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
      '',
    );
    return this.webhookService.toDto(webhookHandle);
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
      '',
    );
    return this.webhookService.toDto(webhookHandle);
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
}
