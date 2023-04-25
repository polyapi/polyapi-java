import { Controller, Get, Logger, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { SpecsService } from 'specs/specs.service';
import { PolyKeyGuard } from 'auth/poly-key-auth-guard.service';
import { GetSpecsDto } from '@poly/common';
import { AuthRequest } from 'common/types';

@Controller('specs')
export class SpecsController {
  private readonly logger = new Logger(SpecsController.name);

  constructor(private readonly service: SpecsService) {
  }

  @UseGuards(PolyKeyGuard)
  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async getSpecifications(@Req() req: AuthRequest, @Query() { contexts, names, ids }: GetSpecsDto) {
    const environmentId = req.user.environment.id;

    this.logger.debug(`Getting all specs for environment ${environmentId} with contexts ${JSON.stringify(contexts)}, names ${JSON.stringify(names)}, ids ${JSON.stringify(ids)}`);

    return this.service.getSpecifications(environmentId, contexts, names, ids);
  }

  @Get('/versions')
  getVersion() {
    return {
      jsVersions: ['0.1.26-dev'],
    };
  }
}
