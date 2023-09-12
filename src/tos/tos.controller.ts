import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { Role } from '@poly/model';
import { TosService } from './tos.service';
import { CreateTosDto, TosDto } from '@poly/model';
import { ApiOperation } from '@nestjs/swagger';
import { API_TAG_INTERNAL } from 'common/constants';

@Controller('tos')
export class TosController {
  constructor(
        private readonly service: TosService,
  ) {}

  @ApiOperation({ tags: [API_TAG_INTERNAL] })
  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Post('')
  create(
    @Body() data: CreateTosDto,
  ): Promise<TosDto | undefined> {
    return this.service.create(data.content, data.version);
  }

  @Get('/default')
  async getDefaultTos(): Promise<TosDto> {
    const tos = await this.service.getDefault();

    if (!tos) {
      throw new NotFoundException('Default Tos record not found.');
    }

    return tos;
  }

  @Get('')
  async getTosList(): Promise<TosDto[]> {
    return this.service.get();
  }

  @Get('/:version')
  async getTosVersion(
    @Param('version') version: string,
  ): Promise<TosDto> {
    const tos = await this.service.findTosVersion(version);

    if (!tos) {
      throw new NotFoundException('Tos record not found.');
    }

    return tos;
  }
}
