import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PolyKeyGuard } from 'auth/poly-key-auth-guard.service';
import { TenantService } from 'tenant/tenant.service';
import {
  CreateEnvironmentDto,
  CreateTeamDto,
  CreateTenantDto,
  CreateUserDto,
  CreateUserKeyDto,
  EnvironmentDto,
  GetTenantQuery,
  Role,
  TeamDto,
  TenantDto,
  UpdateEnvironmentDto,
  UpdateTeamDto,
  UpdateTenantDto,
  UpdateUserDto,
  UpdateUserKeyDto,
  UserDto,
  UserKeyDto,
} from '@poly/common';
import { EnvironmentService } from 'environment/environment.service';
import { TeamService } from 'team/team.service';
import { AuthService } from 'auth/auth.service';
import { AuthRequest } from 'common/types';
import { UserService } from 'user/user.service';

@Controller('tenants')
export class TenantController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly environmentService: EnvironmentService,
    private readonly teamService: TeamService,
    private readonly userService: UserService,
  ) {
  }

  @UseGuards(new PolyKeyGuard([Role.SuperAdmin]))
  @Get()
  async getTenants(): Promise<TenantDto[]> {
    return (await this.tenantService.getAll())
      .map(tenant => this.tenantService.toDto(tenant));
  }

  @UseGuards(new PolyKeyGuard([Role.SuperAdmin]))
  @Post()
  async createTenant(@Body() data: CreateTenantDto): Promise<TenantDto> {
    const { name } = data;
    return this.tenantService.toDto(await this.tenantService.create(name));
  }

  @UseGuards(PolyKeyGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @Get(':id')
  async getTenant(@Req() req: AuthRequest, @Param('id') id: string, @Query() { full = false }: GetTenantQuery): Promise<TenantDto> {
    const tenant = await this.findTenant(id);

    await this.authService.checkTenantAccess(tenant.id, req.user, [Role.Admin]);

    return full
      ? this.tenantService.toFullDto(tenant)
      : this.tenantService.toDto(tenant);
  }

  @UseGuards(new PolyKeyGuard([Role.SuperAdmin]))
  @Post(':id')
  async updateTenant(@Param('id') id: string, @Body() data: UpdateTenantDto): Promise<TenantDto> {
    const { name } = data;
    return this.tenantService.toDto(
      await this.tenantService.update(await this.findTenant(id), name),
    );
  }

  @UseGuards(new PolyKeyGuard([Role.SuperAdmin]))
  @Delete(':id')
  async deleteTenant(@Param('id') id: string) {
    await this.tenantService.delete(await this.findTenant(id));
  }

  @UseGuards(PolyKeyGuard)
  @Get(':id/teams')
  async getTeams(@Req() req: AuthRequest, @Param('id') tenantId: string): Promise<TeamDto[]> {
    const tenant = await this.findTenant(tenantId);
    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);
    return (await this.teamService.getAllByTenant(tenant.id))
      .map(team => this.teamService.toDto(team));
  }

  @UseGuards(PolyKeyGuard)
  @Post(':id/teams')
  async createTeam(@Req() req: AuthRequest, @Param('id') tenantId: string, @Body() data: CreateTeamDto): Promise<TeamDto> {
    const tenant = await this.findTenant(tenantId);
    const { name } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.teamService.toDto(
      await this.teamService.create(tenant.id, name),
    );
  }

  @UseGuards(PolyKeyGuard)
  @Get(':id/teams/:teamId')
  async getTeam(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('teamId') teamId: string): Promise<TeamDto> {
    const team = await this.findTeam(tenantId, teamId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.teamService.toDto(team);
  }

  @UseGuards(PolyKeyGuard)
  @Patch(':id/teams/:teamId')
  async updateTeam(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('teamId') teamId: string, @Body() data: UpdateTeamDto): Promise<TeamDto> {
    const team = await this.findTeam(tenantId, teamId);
    const { name } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.teamService.toDto(
      await this.teamService.update(team, name),
    );
  }

  @UseGuards(PolyKeyGuard)
  @Delete(':id/teams/:teamId')
  async deleteTeam(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('teamId') teamId: string) {
    const team = await this.findTeam(tenantId, teamId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    await this.teamService.delete(team.id);
  }

  @UseGuards(PolyKeyGuard)
  @Get(':id/teams/:teamId/users')
  async getUsers(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('teamId') teamId: string): Promise<UserDto[]> {
    const team = await this.findTeam(tenantId, teamId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return (await this.userService.getAllUsersByTeam(team.id))
      .map(user => this.userService.toUserDto(user));
  }

  @UseGuards(PolyKeyGuard)
  @Post(':id/teams/:teamId/users')
  async createUser(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('teamId') teamId: string, @Body() data: CreateUserDto): Promise<UserDto> {
    const team = await this.findTeam(tenantId, teamId);
    const { name, role = Role.User } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.userService.toUserDto(
      await this.userService.createUser(team.id, name, role as Role),
    );
  }

  @UseGuards(PolyKeyGuard)
  @Get(':id/teams/:teamId/users/:userId')
  async getUser(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
  ): Promise<UserDto> {
    const user = await this.findUser(tenantId, teamId, userId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.userService.toUserDto(user);
  }

  @UseGuards(PolyKeyGuard)
  @Patch(':id/teams/:teamId/users/:userId')
  async updateUser(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Body() data: UpdateUserDto,
  ): Promise<UserDto> {
    const user = await this.findUser(tenantId, teamId, userId);
    const { name, role } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.userService.toUserDto(
      await this.userService.updateUser(user, name, role as Role),
    );
  }

  @UseGuards(PolyKeyGuard)
  @Delete(':id/teams/:teamId/users/:userId')
  async deleteUser(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('teamId') teamId: string, @Param('userId') userId: string) {
    const user = await this.findUser(tenantId, teamId, userId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    await this.userService.deleteUser(user.id);
  }

  @UseGuards(PolyKeyGuard)
  @Get(':id/teams/:teamId/users/:userId/keys')
  async getUserKeys(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('teamId') teamId: string, @Param('userId') userId: string): Promise<UserKeyDto[]> {
    await this.findUser(tenantId, teamId, userId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return (await this.userService.getAllUserKeys(userId))
      .map(user => this.userService.toUserKeyDto(user));
  }

  @UseGuards(PolyKeyGuard)
  @Post(':id/teams/:teamId/users/:userId/keys')
  async createUserKey(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Body() data: CreateUserKeyDto,
  ): Promise<UserKeyDto> {
    const user = await this.findUser(tenantId, teamId, userId);
    const { environmentId, permissions } = data;
    const environment = await this.findEnvironment(tenantId, environmentId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.userService.toUserKeyDto(
      await this.userService.createOrUpdateUserKey(user, environment.id, permissions),
    );
  }

  @UseGuards(PolyKeyGuard)
  @Get(':id/teams/:teamId/users/:userId/keys/:userKeyId')
  async getUserKey(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Param('userKeyId') userKeyId: string,
  ): Promise<UserKeyDto> {
    const userKey = await this.findUserKey(tenantId, teamId, userId, userKeyId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.userService.toUserKeyDto(userKey);
  }

  @UseGuards(PolyKeyGuard)
  @Patch(':id/teams/:teamId/users/:userId/keys/:userKeyId')
  async updateUserKey(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Param('userKeyId') userKeyId: string,
    @Body() data: UpdateUserKeyDto,
  ): Promise<UserKeyDto> {
    const userKey = await this.findUserKey(tenantId, teamId, userId, userKeyId);
    const { permissions } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.userService.toUserKeyDto(
      await this.userService.updateUserKey(userKey, permissions),
    );
  }

  @UseGuards(PolyKeyGuard)
  @Delete(':id/teams/:teamId/users/:userId/keys/:userKeyId')
  async deleteUserKey(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Param('userKeyId') userKeyId: string,
  ) {
    const userKey = await this.findUserKey(tenantId, teamId, userId, userKeyId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    await this.userService.deleteUserKey(userKey.id);
  }

  @UseGuards(PolyKeyGuard)
  @Get(':id/environments')
  async getEnvironments(@Req() req: AuthRequest, @Param('id') tenantId: string): Promise<EnvironmentDto[]> {
    const tenant = await this.findTenant(tenantId);
    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);
    return (await this.environmentService.getAllByTenant(tenant.id))
      .map(environment => this.environmentService.toDto(environment));
  }

  @UseGuards(PolyKeyGuard)
  @Post(':id/environments')
  async createEnvironment(@Req() req: AuthRequest, @Param('id') tenantId: string, @Body() data: CreateEnvironmentDto): Promise<EnvironmentDto> {
    const tenant = await this.findTenant(tenantId);
    const { name } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.environmentService.toDto(
      await this.environmentService.create(tenant.id, name),
    );
  }

  @UseGuards(PolyKeyGuard)
  @Get(':id/environments/:environmentId')
  async getEnvironment(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('environmentId') environmentId: string,
  ): Promise<EnvironmentDto> {
    const environment = await this.findEnvironment(tenantId, environmentId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.environmentService.toDto(environment);
  }

  @UseGuards(PolyKeyGuard)
  @Patch(':id/environments/:environmentId')
  async updateEnvironment(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('environmentId') environmentId: string,
    @Body() data: UpdateEnvironmentDto,
  ): Promise<EnvironmentDto> {
    const environment = await this.findEnvironment(tenantId, environmentId);
    const { name } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.environmentService.toDto(
      await this.environmentService.update(environment, name),
    );
  }

  @UseGuards(PolyKeyGuard)
  @Delete(':id/environments/:environmentId')
  async deleteEnvironment(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('environmentId') environmentId: string) {
    const environment = await this.findEnvironment(tenantId, environmentId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    await this.environmentService.delete(environment.id);
  }

  private async findTenant(id: string) {
    const tenant = await this.tenantService.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant with id ${id} not found`);
    }
    return tenant;
  }

  private async findTeam(tenantId: string, id: string) {
    const tenant = await this.findTenant(tenantId);
    const team = await this.teamService.findById(id);
    if (!team || team.tenantId !== tenant.id) {
      throw new NotFoundException(`Team with id ${id} not found`);
    }
    return team;
  }

  private async findUser(tenantId: string, teamId: string, userId: string) {
    const team = await this.findTeam(tenantId, teamId);
    const user = await this.userService.findUserById(userId);

    if (!user || user.teamId !== team.id) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    return user;
  }

  private async findUserKey(tenantId: string, teamId: string, userId: string, userKeyId: string) {
    const user = await this.findUser(tenantId, teamId, userId);
    const userKey = await this.userService.findUserKeyById(userKeyId);

    if (!userKey || userKey.userId !== user.id) {
      throw new NotFoundException(`UserKey with id ${userKeyId} not found`);
    }
    return userKey;
  }

  private async findEnvironment(tenantId: string, environmentId: string) {
    const tenant = await this.findTenant(tenantId);
    const environment = await this.environmentService.findById(environmentId);

    if (!environment || environment.tenantId !== tenant.id) {
      throw new NotFoundException(`Environment with id ${environmentId} not found`);
    }

    return environment;
  }
}
