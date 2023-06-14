import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { WebhookService } from 'webhook/webhook.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { CreateWebhookHandleDto, Permission, UpdateWebhookHandleDto } from '@poly/common';
import { AuthRequest } from 'common/types';
import { AuthService } from 'auth/auth.service';

@ApiSecurity('PolyApiKey')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  public constructor(private readonly webhookService: WebhookService, private readonly authService: AuthService) {}

  @UseGuards(PolyAuthGuard)
  @Get()
  public async getWebhookHandles(@Req() req: AuthRequest) {
    const webhookHandles = await this.webhookService.getWebhookHandles(req.user.environment.id);
    return webhookHandles.map((handle) => this.webhookService.toDto(handle));
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id')
  public async getWebhookHandle(@Req() req: AuthRequest, @Param('id') id: string) {
    const webhookHandle = await this.webhookService.findWebhookHandle(id);

    if (!webhookHandle) {
      throw new NotFoundException();
    }

    await this.authService.checkEnvironmentEntityAccess(webhookHandle, req.user, false, Permission.Teach);

    return this.webhookService.toDto(webhookHandle);
  }

  @UseGuards(PolyAuthGuard)
  @Post()
  public async createWebhookHandle(@Req() req: AuthRequest, @Body() createWebhookHandle: CreateWebhookHandleDto) {
    const { context = '', name, eventPayload, description = '' } = createWebhookHandle;

    await this.authService.checkPermissions(req.user, Permission.Teach);

    const webhookHandle = await this.webhookService.createOrUpdateWebhookHandle(
      req.user.environment.id,
      context,
      name,
      eventPayload,
      description,
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
    } = updateWebhookHandleDto;

    const webhookHandle = await this.webhookService.findWebhookHandle(id);
    if (!webhookHandle) {
      throw new NotFoundException();
    }

    await this.authService.checkEnvironmentEntityAccess(webhookHandle, req.user, false, Permission.Teach);

    return this.webhookService.toDto(
      await this.webhookService.updateWebhookHandle(webhookHandle, context, name, description, visibility),
    );
  }

  @Post(':id')
  public async triggerWebhookHandle(@Param('id') id: string, @Body() payload: any) {
    const webhookHandle = await this.webhookService.findWebhookHandle(id);

    if (!webhookHandle) {
      this.logger.debug(`Webhook handle not found for ${id} - skipping trigger...`);
      return;
    }

    return await this.webhookService.triggerWebhookHandle(webhookHandle, payload);
  }

  @Delete(':id')
  @UseGuards(PolyAuthGuard)
  public async deleteWebhookHandle(@Req() req: AuthRequest, @Param('id') id: string) {
    const webhookHandle = await this.webhookService.findWebhookHandle(id);
    if (!webhookHandle) {
      throw new NotFoundException();
    }

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
      req.user.environment.id,
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

    const webhookHandle = await this.webhookService.createOrUpdateWebhookHandle(req.user.environment.id, null, name, payload, '');
    return this.webhookService.toDto(webhookHandle);
  }
}
