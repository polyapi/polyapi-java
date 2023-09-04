import { Body, Controller, Delete, Get, Logger, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { AuthData, AuthRequest } from 'common/types';
import { TriggerService } from 'trigger/trigger.service';
import { CreateTriggerDto, Role, TriggerDestination, TriggerResponseDto, TriggerSource } from '@poly/model';
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

  @UseGuards(new PolyAuthGuard([Role.Admin]))
  @Get()
  async getTriggers(@Req() req: AuthRequest) {
    return await this.triggerService.getTriggers(req.user.environment.id);
  }

  @UseGuards(new PolyAuthGuard([Role.Admin]))
  @Post()
  async createTrigger(@Req() req: AuthRequest, @Body() data: CreateTriggerDto) {
    const { source, destination } = data;
    await this.checkTriggerSource(req, source);
    await this.checkTriggerDestination(req, destination);

    return await this.triggerService.createTrigger(req.user.environment.id, source, destination);
  }

  @UseGuards(new PolyAuthGuard([Role.Admin]))
  @Get(':id')
  async getTrigger(@Req() req: AuthRequest, @Param('id') id: string) {
    return await this.findTrigger(req.user, id);
  }

  @UseGuards(new PolyAuthGuard([Role.Admin]))
  @Delete(':id')
  async deleteTrigger(@Req() req: AuthRequest, @Param('id') id: string) {
    const trigger = await this.findTrigger(req.user, id);
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
}
