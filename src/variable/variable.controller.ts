import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { VariableService } from 'variable/variable.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { CreateVariableDto, Permission, UpdateVariableDto, VariableDto, Visibility } from '@poly/model';
import { AuthData, AuthRequest } from 'common/types';
import { AuthService } from 'auth/auth.service';

@ApiSecurity('PolyApiKey')
@Controller('variables')
export class VariableController {
  constructor(
    private readonly service: VariableService,
    private readonly authService: AuthService,
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

    return this.service.toDto(variable);
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id')
  async getVariable(@Req() req: AuthRequest, @Param('id') id: string): Promise<VariableDto> {
    const variable = await this.findVariable(req.user, id);

    await this.authService.checkPermissions(req.user, Permission.Use);

    return this.service.toDto(variable);
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id/value')
  async getVariableValue(@Req() req: AuthRequest, @Param('id') id: string): Promise<VariableDto> {
    const variable = await this.findVariable(req.user, id);
    if (variable.secret) {
      throw new NotFoundException(`Variable with id '${id}' is secret`);
    }

    await this.authService.checkPermissions(req.user, Permission.Use);

    return this.service.getVariableValue(variable);
  }

  @UseGuards(PolyAuthGuard)
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

    return this.service.toDto(
      await this.service.updateVariable(req.user.environment.id, variable, name, context, description, value, visibility, secret),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Delete(':id')
  async deleteVariable(@Req() req: AuthRequest, @Param('id') id: string): Promise<void> {
    const variable = await this.findVariable(req.user, id);

    await this.authService.checkPermissions(
      req.user,
      variable.secret
        ? Permission.ManageSecretVariables
        : Permission.ManageNonSecretVariables,
    );

    await this.service.deleteVariable(variable);
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
