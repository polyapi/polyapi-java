import { Body, Controller, UseGuards, Patch, Get, Param, Delete } from '@nestjs/common';
import { Role, SetConfigVariableDto } from '@poly/common';
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
    return this.service.toDto(await this.service.get(name));
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Delete('/:name')
  public async deleteConfigVariable(@Param('name') name: string) {
    return this.service.toDto(await this.service.delete(name));
  }
}
