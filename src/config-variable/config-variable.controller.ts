import { Body, Controller, UseGuards, Patch } from '@nestjs/common';
import { Role, CreateConfigVariableDto } from '@poly/common';
import { ApiSecurity } from '@nestjs/swagger';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { ConfigVariableService } from './config-varirable.service';

@ApiSecurity('PolyApiKey')
@Controller('config-variable')
export class ConfigVariableController {
  constructor(private readonly configVariableService: ConfigVariableService) {}

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Patch('')
  public async createOrUpdateConfigVariable(@Body() body: CreateConfigVariableDto): Promise<void> {
    this.configVariableService.configure(body.name, body.value);
  }
}
