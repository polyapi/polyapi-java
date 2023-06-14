import {
  BadRequestException,
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
import { ApiSecurity } from '@nestjs/swagger';
import { TenantService } from 'tenant/tenant.service';
import {
  ApiKeyDto,
  ApplicationDto,
  CreateApiKeyDto,
  CreateApplicationDto,
  CreateEnvironmentDto,
  CreateTeamDto,
  CreateTeamMemberDto,
  CreateTenantDto,
  CreateUserDto,
  EnvironmentDto,
  GetTenantQuery,
  Role,
  TeamDto,
  TeamMemberDto,
  TenantDto,
  UpdateApiKeyDto,
  UpdateApplicationDto,
  UpdateEnvironmentDto,
  UpdateTeamDto,
  UpdateTenantDto,
  UpdateUserDto,
  UserDto,
} from '@poly/common';
import { EnvironmentService } from 'environment/environment.service';
import { TeamService } from 'team/team.service';
import { AuthService } from 'auth/auth.service';
import { AuthRequest } from 'common/types';
import { UserService } from 'user/user.service';
import { ApplicationService } from 'application/application.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';

@ApiSecurity('PolyApiKey')
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly environmentService: EnvironmentService,
    private readonly teamService: TeamService,
    private readonly userService: UserService,
    private readonly applicationService: ApplicationService,
  ) {
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Get()
  async getTenants(): Promise<TenantDto[]> {
    return (await this.tenantService.getAll())
      .map(tenant => this.tenantService.toDto(tenant));
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Post()
  async createTenant(@Body() data: CreateTenantDto): Promise<TenantDto> {
    const { name, publicVisibilityAllowed } = data;
    return this.tenantService.toDto(await this.tenantService.create(name, publicVisibilityAllowed));
  }

  @UseGuards(PolyAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @Get(':id')
  async getTenant(@Req() req: AuthRequest, @Param('id') id: string, @Query() { full = false }: GetTenantQuery): Promise<TenantDto> {
    const tenant = await this.findTenant(id);

    await this.authService.checkTenantAccess(tenant.id, req.user, [Role.Admin]);

    return full
      ? this.tenantService.toFullDto(tenant)
      : this.tenantService.toDto(tenant);
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Patch(':id')
  async updateTenant(@Param('id') id: string, @Body() data: UpdateTenantDto): Promise<TenantDto> {
    const { name, publicVisibilityAllowed } = data;
    return this.tenantService.toDto(
      await this.tenantService.update(await this.findTenant(id), name, publicVisibilityAllowed),
    );
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Delete(':id')
  async deleteTenant(@Param('id') id: string) {
    await this.tenantService.delete(await this.findTenant(id));
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id/users')
  async getUsers(@Req() req: AuthRequest, @Param('id') tenantId: string): Promise<UserDto[]> {
    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return (await this.userService.getAllUsersByTenant(tenantId))
      .map(user => this.userService.toUserDto(user));
  }

  @UseGuards(PolyAuthGuard)
  @Post(':id/users')
  async createUser(@Req() req: AuthRequest, @Param('id') tenantId: string, @Body() data: CreateUserDto): Promise<UserDto> {
    const { name, role = Role.User } = data;

    if (role === Role.SuperAdmin) {
      throw new BadRequestException('SuperAdmin role is not allowed to be set');
    }

    await this.findTenant(tenantId);
    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.userService.toUserDto(
      await this.userService.createUser(tenantId, name, role as Role),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id/users/:userId')
  async getUser(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('userId') userId: string,
  ): Promise<UserDto> {
    const user = await this.findUser(tenantId, userId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.userService.toUserDto(user);
  }

  @UseGuards(PolyAuthGuard)
  @Patch(':id/users/:userId')
  async updateUser(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('userId') userId: string,
    @Body() data: UpdateUserDto,
  ): Promise<UserDto> {
    const user = await this.findUser(tenantId, userId);
    const { name, role } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.userService.toUserDto(
      await this.userService.updateUser(user, name, role as Role),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Delete(':id/users/:userId')
  async deleteUser(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('userId') userId: string) {
    const user = await this.findUser(tenantId, userId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    await this.userService.deleteUser(user.id);
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id/teams')
  async getTeams(@Req() req: AuthRequest, @Param('id') tenantId: string): Promise<TeamDto[]> {
    const tenant = await this.findTenant(tenantId);
    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);
    return (await this.teamService.getAllTeamsByTenant(tenant.id))
      .map(team => this.teamService.toTeamDto(team));
  }

  @UseGuards(PolyAuthGuard)
  @Post(':id/teams')
  async createTeam(@Req() req: AuthRequest, @Param('id') tenantId: string, @Body() data: CreateTeamDto): Promise<TeamDto> {
    const tenant = await this.findTenant(tenantId);
    const { name } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.teamService.toTeamDto(
      await this.teamService.createTeam(tenant.id, name),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id/teams/:teamId')
  async getTeam(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('teamId') teamId: string): Promise<TeamDto> {
    const team = await this.findTeam(tenantId, teamId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.teamService.toTeamDto(team);
  }

  @UseGuards(PolyAuthGuard)
  @Patch(':id/teams/:teamId')
  async updateTeam(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('teamId') teamId: string, @Body() data: UpdateTeamDto): Promise<TeamDto> {
    const team = await this.findTeam(tenantId, teamId);
    const { name } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.teamService.toTeamDto(
      await this.teamService.updateTeam(team, name),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Delete(':id/teams/:teamId')
  async deleteTeam(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('teamId') teamId: string) {
    const team = await this.findTeam(tenantId, teamId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    await this.teamService.deleteTeam(team.id);
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id/teams/:teamId/members')
  async getMembers(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('teamId') teamId: string): Promise<TeamMemberDto[]> {
    const team = await this.findTeam(tenantId, teamId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return (await this.teamService.getAllMembersByTeam(team.id))
      .map(member => this.teamService.toMemberDto(member));
  }

  @UseGuards(PolyAuthGuard)
  @Post(':id/teams/:teamId/members')
  async createMember(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('teamId') teamId: string,
    @Body() data: CreateTeamMemberDto,
  ): Promise<TeamMemberDto> {
    const { userId } = data;
    const team = await this.findTeam(tenantId, teamId);
    const user = await this.findUser(tenantId, userId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    if (await this.teamService.checkMemberExists(team.id, userId)) {
      throw new BadRequestException('Given user is already member of this team.');
    }

    return this.teamService.toMemberDto(
      await this.teamService.createMember(team.id, user.id),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id/teams/:teamId/members/:memberId')
  async getMember(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
  ): Promise<TeamMemberDto> {
    const member = await this.findMember(tenantId, teamId, memberId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.teamService.toMemberDto(member);
  }

  @UseGuards(PolyAuthGuard)
  @Delete(':id/teams/:teamId/members/:memberId')
  async deleteMember(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('teamId') teamId: string, @Param('memberId') memberId: string) {
    const member = await this.findMember(tenantId, teamId, memberId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    await this.teamService.deleteMember(member.id);
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id/environments')
  async getEnvironments(@Req() req: AuthRequest, @Param('id') tenantId: string): Promise<EnvironmentDto[]> {
    const tenant = await this.findTenant(tenantId);
    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);
    return (await this.environmentService.getAllByTenant(tenant.id))
      .map(environment => this.environmentService.toDto(environment));
  }

  @UseGuards(PolyAuthGuard)
  @Post(':id/environments')
  async createEnvironment(@Req() req: AuthRequest, @Param('id') tenantId: string, @Body() data: CreateEnvironmentDto): Promise<EnvironmentDto> {
    const tenant = await this.findTenant(tenantId);
    const { name } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.environmentService.toDto(
      await this.environmentService.create(tenant.id, name),
    );
  }

  @UseGuards(PolyAuthGuard)
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

  @UseGuards(PolyAuthGuard)
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

  @UseGuards(PolyAuthGuard)
  @Delete(':id/environments/:environmentId')
  async deleteEnvironment(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('environmentId') environmentId: string) {
    const environment = await this.findEnvironment(tenantId, environmentId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    await this.environmentService.delete(environment.id);
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id/environments/:environmentId/api-keys')
  async getApiKeys(@Req() req: AuthRequest, @Param('id') tenantId: string, @Param('environmentId') environmentId: string): Promise<ApiKeyDto[]> {
    await this.findEnvironment(tenantId, environmentId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return (await this.authService.getAllApiKeys(environmentId))
      .map(apiKey => this.authService.toApiKeyDto(apiKey));
  }

  @UseGuards(PolyAuthGuard)
  @Post(':id/environments/:environmentId/api-keys')
  async createApiKey(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('environmentId') environmentId: string,
    @Body() data: CreateApiKeyDto,
  ): Promise<ApiKeyDto> {
    const { name, applicationId = null, userId = null, permissions } = data;
    await this.findEnvironment(tenantId, environmentId);

    if (!userId && !applicationId) {
      throw new BadRequestException('Either userId or applicationId must be provided');
    }
    if (userId && applicationId) {
      throw new BadRequestException('Either userId or applicationId must be provided, not both');
    }
    const application = applicationId ? await this.findApplication(tenantId, applicationId) : null;
    const user = userId ? await this.findUser(tenantId, userId) : null;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.authService.toApiKeyDto(
      await this.authService.createApiKey(environmentId, name, application, user, permissions),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id/environments/:environmentId/api-keys/:apiKeyId')
  async getApiKey(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('environmentId') environmentId: string,
    @Param('apiKeyId') apiKeyId: string,
  ): Promise<ApiKeyDto> {
    const apiKey = await this.findApiKey(tenantId, environmentId, apiKeyId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.authService.toApiKeyDto(apiKey);
  }

  @UseGuards(PolyAuthGuard)
  @Patch(':id/environments/:environmentId/api-keys/:apiKeyId')
  async updateApiKey(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('environmentId') environmentId: string,
    @Param('apiKeyId') apiKeyId: string,
    @Body() data: UpdateApiKeyDto,
  ): Promise<ApiKeyDto> {
    const apiKey = await this.findApiKey(tenantId, environmentId, apiKeyId);
    const { name, permissions } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.authService.toApiKeyDto(
      await this.authService.updateApiKey(apiKey, name, permissions),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Delete(':id/environments/:environmentId/api-keys/:apiKeyId')
  async deleteApiKey(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('environmentId') environmentId: string,
    @Param('apiKeyId') apiKeyId: string,
  ) {
    const apiKey = await this.findApiKey(tenantId, environmentId, apiKeyId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    await this.authService.deleteApiKey(apiKey.id);
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id/applications')
  async getApplications(@Req() req: AuthRequest, @Param('id') tenantId: string): Promise<ApplicationDto[]> {
    await this.findTenant(tenantId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return (await this.applicationService.getAll(tenantId))
      .map(application => this.applicationService.toApplicationDto(application));
  }

  @UseGuards(PolyAuthGuard)
  @Post(':id/applications')
  async createApplication(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Body() data: CreateApplicationDto,
  ): Promise<ApplicationDto> {
    const { name, description } = data;
    await this.findTenant(tenantId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.applicationService.toApplicationDto(
      await this.applicationService.create(tenantId, name, description),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id/applications/:applicationId')
  async getApplication(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('applicationId') applicationId: string,
  ): Promise<ApplicationDto> {
    const application = await this.findApplication(tenantId, applicationId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.applicationService.toApplicationDto(application);
  }

  @UseGuards(PolyAuthGuard)
  @Patch(':id/applications/:applicationId')
  async updateApplication(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('applicationId') applicationId: string,
    @Body() data: UpdateApplicationDto,
  ): Promise<ApplicationDto> {
    const application = await this.findApplication(tenantId, applicationId);
    const { name, description } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.applicationService.toApplicationDto(
      await this.applicationService.update(application, name, description),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Delete(':id/applications/:applicationId')
  async deleteApplication(
    @Req() req: AuthRequest,
    @Param('id') tenantId: string,
    @Param('applicationId') applicationId: string,
  ) {
    const application = await this.findApplication(tenantId, applicationId);

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    await this.applicationService.delete(application.id);
  }

  private async findTenant(id: string) {
    const tenant = await this.tenantService.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant with id ${id} not found`);
    }
    return tenant;
  }

  private async findUser(tenantId: string, userId: string) {
    const tenant = await this.findTenant(tenantId);
    const user = await this.userService.findUserById(userId);

    if (!user || (user.tenantId !== tenant.id)) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    return user;
  }

  private async findTeam(tenantId: string, id: string) {
    const tenant = await this.findTenant(tenantId);
    const team = await this.teamService.findTeamById(id);
    if (!team || team.tenantId !== tenant.id) {
      throw new NotFoundException(`Team with id ${id} not found`);
    }
    return team;
  }

  private async findMember(tenantId: string, teamId: string, memberId: string) {
    const team = teamId ? await this.findTeam(tenantId, teamId) : null;
    const member = await this.teamService.findMemberById(memberId);

    if (!member || (team && member.teamId !== team.id)) {
      throw new NotFoundException(`Member with id ${memberId} not found`);
    }
    return member;
  }

  private async findEnvironment(tenantId: string, environmentId: string) {
    const tenant = await this.findTenant(tenantId);
    const environment = await this.environmentService.findById(environmentId);

    if (!environment || environment.tenantId !== tenant.id) {
      throw new NotFoundException(`Environment with id ${environmentId} not found`);
    }

    return environment;
  }

  private async findApiKey(tenantId: string, environmentId: string, apiKeyId: string) {
    await this.findEnvironment(tenantId, environmentId);
    const apiKey = await this.authService.findApiKeyById(apiKeyId, true);

    if (!apiKey || apiKey.environmentId !== environmentId) {
      throw new NotFoundException(`ApiKey with id ${apiKeyId} not found`);
    }
    return apiKey;
  }

  private async findApplication(tenantId: string, applicationId: string) {
    await this.findTenant(tenantId);
    const application = await this.applicationService.findById(applicationId);

    if (!application || application.tenantId !== tenantId) {
      throw new NotFoundException(`Application with id ${applicationId} not found`);
    }
    return application;
  }
}
