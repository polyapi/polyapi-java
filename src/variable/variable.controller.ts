import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { VariableService } from 'variable/variable.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import {
  ContextVariableValues,
  CreateVariableDto,
  Permission,
  Role,
  UpdateVariableDto,
  ValueType,
  VariableDto,
  VariablePublicDto,
  Visibility,
} from '@poly/model';
import { AuthData, AuthRequest } from 'common/types';
import { AuthService } from 'auth/auth.service';
import { Variable } from '@prisma/client';
import { VariableCallsLimitGuard } from 'limit/variable-calls-limit-guard';
import { StatisticsService } from 'statistics/statistics.service';

@ApiSecurity('PolyApiKey')
@Controller('variables')
export class VariableController {
  constructor(
    private readonly service: VariableService,
    private readonly authService: AuthService,
    private readonly statisticsService: StatisticsService,
  ) {
  }

  @UseGuards(PolyAuthGuard)
  @Get()
  async getVariables(@Req() req: AuthRequest): Promise<VariableDto[]> {
    const environmentId = req.user.environment.id;

    await this.authService.checkPermissions(req.user, [
      Permission.ManageSecretVariables,
      Permission.ManageNonSecretVariables,
      Permission.Use,
    ]);

    const variables = await this.service.getAll(environmentId);
    return Promise.all(
      variables.map(async variable => await this.service.toDto(variable)),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Get('/public')
  async getPublicVariables(@Req() req: AuthRequest): Promise<VariablePublicDto[]> {
    await this.authService.checkPermissions(req.user, [
      Permission.ManageSecretVariables,
      Permission.ManageNonSecretVariables,
      Permission.Use,
    ]);

    const { tenant, environment, user } = req.user;
    const variables = await this.service.getAllPublic(tenant, environment, user?.role === Role.Admin);
    return Promise.all(
      variables.map(async variable => await this.service.toPublicDto(variable)),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Get('/public')
  async getPublicVariable(@Req() req: AuthRequest, @Param('id') id: string): Promise<VariablePublicDto> {
    const { tenant, environment } = req.user;

    await this.authService.checkPermissions(req.user, Permission.Use);

    const variable = await this.service.findPublicById(tenant, environment, id);

    if (!variable) {
      throw new NotFoundException(`Variable with id '${id}' not found`);
    }

    return this.service.toPublicDto(variable);
  }

  @UseGuards(PolyAuthGuard, VariableCallsLimitGuard)
  @Post()
  async createVariable(@Req() req: AuthRequest, @Body() data: CreateVariableDto): Promise<VariableDto> {
    const {
      name,
      context,
      description = '',
      value,
      visibility = Visibility.Environment,
      secret = false,
    } = data;

    await this.authService.checkPermissions(req.user, secret
      ? Permission.ManageSecretVariables
      : Permission.ManageNonSecretVariables);

    const variable = await this.service.createVariable(req.user.environment.id, context, name, description, value, visibility, secret);

    await this.statisticsService.trackVariableCall(req.user, 'create', variable.id);

    return this.service.toDto(variable);
  }

  @UseGuards(PolyAuthGuard, VariableCallsLimitGuard)
  @Get(':id')
  async getVariable(@Req() req: AuthRequest, @Param('id') id: string): Promise<VariableDto> {
    const variable = await this.findVariable(req.user, id);

    await this.authService.checkPermissions(req.user, Permission.Use);
    await this.statisticsService.trackVariableCall(req.user, 'read', variable.id);

    return this.service.toDto(variable);
  }

  @UseGuards(PolyAuthGuard, VariableCallsLimitGuard)
  @Get(':id/value')
  async getVariableValue(@Req() req: AuthRequest, @Param('id') id: string): Promise<ValueType> {
    const variable = await this.findVariable(req.user, id);
    if (variable.secret) {
      throw new NotFoundException(`Variable with id '${id}' is secret`);
    }

    await this.authService.checkPermissions(req.user, Permission.Use);
    await this.statisticsService.trackVariableCall(req.user, 'read', variable.id);

    return this.service.getVariableValue(variable);
  }

  @UseGuards(PolyAuthGuard, VariableCallsLimitGuard)
  @Get('/context/values')
  async getAllContextVariableValues(@Req() req: AuthRequest): Promise<ContextVariableValues> {
    await this.authService.checkPermissions(req.user, Permission.Use);
    await this.statisticsService.trackVariableCall(req.user, 'read-context-values');

    return this.service.getContextVariableValues(req.user.environment.id, req.user.tenant.id, null);
  }

  @UseGuards(PolyAuthGuard, VariableCallsLimitGuard)
  @Get('/context/:context/values')
  async getContextVariableValues(@Req() req: AuthRequest, @Param('context') context: string): Promise<ContextVariableValues> {
    await this.authService.checkPermissions(req.user, Permission.Use);
    await this.statisticsService.trackVariableCall(req.user, 'read-context-values', undefined, context);

    return this.service.getContextVariableValues(req.user.environment.id, req.user.tenant.id, context);
  }

  @UseGuards(PolyAuthGuard, VariableCallsLimitGuard)
  @Patch(':id')
  async updateVariable(@Req() req: AuthRequest, @Param('id') id: string, @Body() data: UpdateVariableDto): Promise<VariableDto> {
    const {
      name,
      context,
      description,
      value,
      visibility,
      secret,
    } = data;
    const variable = await this.findVariable(req.user, id);

    await this.authService.checkPermissions(
      req.user,
      secret ?? variable.secret
        ? Permission.ManageSecretVariables
        : Permission.ManageNonSecretVariables,
    );

    const checkVariableAccess = async (variable: Variable) => {
      if (variable.secret) {
        try {
          await this.authService.checkPermissions(req.user, Permission.ManageSecretVariables);
        } catch (e) {
          if (e instanceof ForbiddenException) {
            throw new ForbiddenException('Cannot use a secret value to set a non-secret variable without \'manageSecretVariables\' permission.');
          }
        }
      }
    };

    await this.statisticsService.trackVariableCall(req.user, 'update', variable.id);

    return this.service.toDto(
      await this.service.updateVariable(
        req.user.environment.id,
        req.user.user?.id || req.user.application?.id || '',
        variable,
        name,
        context,
        description,
        value !== undefined
          ? await this.service.unwrapVariables<ValueType>(req.user, value, checkVariableAccess)
          : undefined,
        visibility,
        secret,
      ),
    );
  }

  @UseGuards(PolyAuthGuard, VariableCallsLimitGuard)
  @Delete(':id')
  async deleteVariable(@Req() req: AuthRequest, @Param('id') id: string): Promise<void> {
    const variable = await this.findVariable(req.user, id);

    await this.authService.checkPermissions(
      req.user,
      variable.secret
        ? Permission.ManageSecretVariables
        : Permission.ManageNonSecretVariables,
    );

    await this.service.deleteVariable(variable, req.user.user?.id || req.user.application?.id || '');
    await this.statisticsService.trackVariableCall(req.user, 'delete', variable.id);
  }

  private async findVariable(authData: AuthData, id: string) {
    const variable = await this.service.findById(id);
    if (!variable) {
      throw new NotFoundException(`Variable with id '${id}' not found`);
    }

    await this.authService.checkEnvironmentEntityAccess(variable, authData);

    return variable;
  }
}
