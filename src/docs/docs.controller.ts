import { Controller, Logger, Get, Post, Delete, UseGuards, Body, Param } from '@nestjs/common';
import { ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { Role } from '@poly/model';
import { DocsService, DocUpdateT } from './docs.service';
import { API_TAG_INTERNAL } from 'common/constants';

@ApiSecurity('PolyApiKey')
@Controller()
export class DocsController {
  private readonly logger = new Logger(DocsController.name);

  constructor(private readonly service: DocsService) {}

  @ApiOperation({ tags: [API_TAG_INTERNAL] })
  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Get('docs')
  async docsList(): Promise<unknown> {
    const docs = await this.service.getDocList();
    const rv = docs.map((doc) => {
      return {
        id: doc.id,
        title: doc.title,
        text: doc.text,
      };
    });
    return rv;
  }

  @ApiOperation({ tags: [API_TAG_INTERNAL] })
  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Post('docs')
  async docsCreate(@Body() data: DocUpdateT): Promise<unknown> {
    const doc = await this.service.createOrUpdateDoc(data);
    return {
      id: doc.id,
      title: doc.title,
      text: doc.text,
    };
  }

  @ApiOperation({ tags: [API_TAG_INTERNAL] })
  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Delete('docs/:id')
  async docsDelete(@Param('id') id: string): Promise<unknown> {
    return await this.service.deleteDoc(id);
  }
}
