import { Body, Controller, Delete, Get, Logger, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { AuthData, AuthRequest } from 'common/types';
import { TriggerService } from 'trigger/trigger.service';
import { CreateTriggerDto, Permission, TriggerDestination, TriggerDto, TriggerResponseDto, TriggerSource, Visibility } from '@poly/model';
import { WebhookService } from 'webhook/webhook.service';
import { FunctionService } from 'function/function.service';
import { AuthService } from 'auth/auth.service';

@ApiSecurity('PolyApiKey')
@Controller('triggers')
export class TriggerController {
  private readonly logger = new Logger(TriggerController.name);

  constructor(
    private readonly triggerService: TriggerService,
    private readonly webhookService: WebhookService,
    private readonly functionService: FunctionService,
    private readonly authService: AuthService,
  ) {
  }

  @UseGuards(PolyAuthGuard)
  @Get()
  async getTriggers(@Req() req: AuthRequest) {
    await this.authService.checkPermissions(req.user, Permission.ManageTriggers);

    return await this.triggerService.getTriggers(req.user.environment.id);
  }

  @UseGuards(PolyAuthGuard)
  @Post()
  async createTrigger(@Req() req: AuthRequest, @Body() data: CreateTriggerDto) {
    const { name = null, source, destination, waitForResponse = false } = data;

    await this.authService.checkPermissions(req.user, Permission.ManageTriggers);
    await this.checkTriggerSource(req, source);
    await this.checkTriggerDestination(req, destination);

    return await this.triggerService.createTrigger(req.user.environment.id, name, source, destination, waitForResponse);
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id')
  async getTrigger(@Req() req: AuthRequest, @Param('id') id: string) {
    const trigger = await this.findTrigger(req.user, id);

    await this.checkTriggerAccess(req.user, trigger);

    return trigger;
  }

  @UseGuards(PolyAuthGuard)
  @Delete(':id')
  async deleteTrigger(@Req() req: AuthRequest, @Param('id') id: string) {
    const trigger = await this.findTrigger(req.user, id);

    await this.checkTriggerAccess(req.user, trigger);

    return await this.triggerService.deleteTrigger(req.user.environment.id, trigger);
  }

  @Post('/response')
  async postTriggerResponse(@Body() response: TriggerResponseDto) {
    const { executionId, data } = response;
    this.logger.debug(`Received trigger response ${executionId} with data ${JSON.stringify(data)}`);

    await this.triggerService.processTriggerResponse(executionId, data);
  }

  private async findTrigger(authData: AuthData, id: string) {
    const trigger = await this.triggerService.findById(authData.environment.id, id);
    if (!trigger) {
      throw new NotFoundException(`Trigger ${id} not found`);
    }
    return trigger;
  }

  private async checkTriggerSource(req: AuthRequest, source: TriggerSource) {
    if (source.webhookHandleId) {
      await this.checkWebhookHandle(req, source.webhookHandleId);
    }
  }

  private async checkTriggerDestination(req: AuthRequest, destination: TriggerDestination) {
    if (destination.serverFunctionId) {
      await this.checkServerFunction(req, destination.serverFunctionId);
    }
  }

  private async checkWebhookHandle(req: AuthRequest, webhookHandleId: string) {
    const webhookHandle = await this.webhookService.findWebhookHandle(webhookHandleId);

    if (!webhookHandle || !await this.authService.hasEnvironmentEntityAccess(webhookHandle, req.user, true)) {
      throw new NotFoundException(`Webhook handle ${webhookHandleId} not found`);
    }
  }

  private async checkServerFunction(req: AuthRequest, functionId: string) {
    const serverFunction = await this.functionService.findServerFunction(functionId);

    if (!serverFunction || !await this.authService.hasEnvironmentEntityAccess(serverFunction, req.user, true)) {
      throw new NotFoundException(`Server function ${functionId} not found`);
    }
  }

  private async checkTriggerAccess(authData: AuthData, trigger: TriggerDto) {
    await this.authService.checkEnvironmentEntityAccess({
      ...trigger,
      visibility: Visibility.Environment,
    }, authData, false, Permission.ManageTriggers);
  }
}
