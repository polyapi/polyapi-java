import { Body, Controller, UseGuards, Patch, Get, Param } from '@nestjs/common';
import { Role, CreateConfigVariableDto } from '@poly/common';
import { ApiSecurity } from '@nestjs/swagger';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { ConfigVariableService } from './config-varirable.service';

@ApiSecurity('PolyApiKey')
@Controller('config-variables')
export class ConfigVariableController {
  constructor(private readonly service: ConfigVariableService) {}

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Patch('')
  public async createOrUpdateConfigVariable(@Body() body: CreateConfigVariableDto) {
    return this.service.toDto(await this.service.configure(body.name, body.value));
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Get('/:name')
  public async getConfigVariable(@Param('name') name: string) {
    return this.service.toDto(await this.service.get(name));
  }
}
