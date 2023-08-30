import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { Role } from '@poly/model';
import { TosService } from './tos.service';
import { CreateTosDto, TosDto } from '@poly/model';
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
  async getTos(
    @Param('id') id?: string,
  ): Promise<TosDto> {
    const tos = await this.service.findOne(id);

    if (!tos) {
      throw new NotFoundException('Tos record not found.');
    }

    return tos;
  }
}
