import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { Role } from '../../packages/model/src/user';
import { TosService } from './tos.service';
import { CreateTosDto, TosDto } from '../../packages/model/src/dto';
import { ApiParam } from '@nestjs/swagger';

@Controller('tos')
export class TosController {
  constructor(
        private readonly service: TosService,
  ) {}

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Post('')
  create(
    @Body() data: CreateTosDto,
  ): Promise<TosDto | undefined> {
    return this.service.create(data.content, data.version);
  }

  @Get('/:id?')
  @ApiParam({
    name: 'id',
    required: false,
  })
  getTos(
    @Param('id') id?: string,
  ): Promise<TosDto> {
    return this.service.findOne(id);
  }
}
