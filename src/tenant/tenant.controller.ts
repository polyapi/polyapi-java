import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes, ValidationPipe,
} from '@nestjs/common';
import { PolyKeyGuard } from 'auth/poly-key-auth-guard.service';
import { TenantService } from 'tenant/tenant.service';
import {
  CreateEnvironmentDto,
  CreateTenantDto,
  GetSpecsDto,
  GetTenantQuery,
  Role,
  UpdateTenantDto,
} from '@poly/common';
import { EnvironmentService } from 'environment/environment.service';
import { TeamService } from 'team/team.service';
import { AuthService } from 'auth/auth.service';
import { AuthRequest } from 'common/types';

@Controller('tenants')
export class TenantController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly environmentService: EnvironmentService,
    private readonly teamService: TeamService,
  ) {
  }

  @UseGuards(new PolyKeyGuard([Role.SuperAdmin]))
  @Get()
  async getAll() {
    return (await this.tenantService.getAll())
      .map(tenant => this.tenantService.toDto(tenant));
  }

  @UseGuards(new PolyKeyGuard([Role.SuperAdmin]))
  @Post()
  async createTenant(@Body() data: CreateTenantDto) {
    const { name } = data;
    return this.tenantService.toDto(await this.tenantService.create(name));
  }

  @UseGuards(PolyKeyGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @Get(':id')
  async getTenant(@Req() req: AuthRequest, @Param('id') id: string, @Query() { full = false }: GetTenantQuery) {
    const tenant = await this.findTenant(id);

    await this.authService.checkTenantAccess(tenant.id, req.user, [Role.Admin]);

    return full
      ? this.tenantService.toFullDto(tenant)
      : this.tenantService.toDto(tenant);
  }

  @UseGuards(new PolyKeyGuard([Role.SuperAdmin]))
  @Post(':id')
  async updateTenant(@Param('id') id: string, @Body() data: UpdateTenantDto) {
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
  @Get(':id/environments')
  async getTenantEnvironments(@Req() req: AuthRequest, @Param('id') tenantId: string) {
    const tenant = await this.findTenant(tenantId);
    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);
    return (await this.environmentService.getAllByTenant(tenant.id))
      .map(environment => this.environmentService.toDto(environment));
  }

  @UseGuards(PolyKeyGuard)
  @Post(':id/environments')
  async createTenantEnvironment(@Req() req: AuthRequest, @Param('id') tenantId: string, @Body() data: CreateEnvironmentDto) {
    const tenant = await this.findTenant(tenantId);
    const { name } = data;

    await this.authService.checkTenantAccess(tenantId, req.user, [Role.Admin]);

    return this.environmentService.toDto(
      await this.environmentService.create(tenant.id, name),
    );
  }

  @UseGuards(new PolyKeyGuard([Role.SuperAdmin]))
  @Post(':id/teams')
  async createTenantTeam(@Param('id') id: string, @Body() data: { name: string }) {

  }

  private async findTenant(id: string) {
    const tenant = await this.tenantService.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant with id ${id} not found`);
    }
    return tenant;
  }
}
