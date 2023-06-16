import { Body, Controller, UseGuards, Patch, Get, Param, Delete, NotFoundException } from '@nestjs/common';
import { Role, SetConfigVariableDto } from '@poly/model';
import { ApiSecurity } from '@nestjs/swagger';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { ConfigVariableService } from './config-varirable.service';

@ApiSecurity('PolyApiKey')
@Controller('config-variables')
export class ConfigVariableController {
  constructor(private readonly service: ConfigVariableService) {}

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Patch('')
  public async createOrUpdateConfigVariable(@Body() body: SetConfigVariableDto) {
    return this.service.toDto(await this.service.configure(body.name, body.value));
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Get('/:name')
  public async getConfigVariable(@Param('name') name: string) {
    const configVariable = await this.findConfigVariable(name);
    return this.service.toDto(configVariable);
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Delete('/:name')
  public async deleteConfigVariable(@Param('name') name: string) {
    const configVariable = await this.findConfigVariable(name);

    return this.service.toDto(await this.service.delete(configVariable));
  }

  /**
   * Find config variable by instance level, leaving tenantId = null and environmentId = null on `this.service.find()` call.
   */
  private async findConfigVariable(name: string) {
    const configVariable = await this.service.find(name);

    if (!configVariable) {
      throw new NotFoundException('Config variable not found.');
    }

    return configVariable;
  }
}
