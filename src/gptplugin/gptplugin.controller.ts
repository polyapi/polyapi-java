import { Controller, Logger, Get, Post, UseGuards, Req, Body, Param } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { Request } from 'express';
import { CreatePluginDto } from '@poly/common';
import { PolyKeyGuard } from 'auth/poly-key-auth-guard.service';
import { GptPluginService } from 'gptplugin/gptplugin.service';
import { AuthRequest } from 'common/types';

@ApiSecurity('X-PolyApiKey')
@Controller()
export class GptPluginController {
  private readonly logger = new Logger(GptPluginController.name);

  constructor(private readonly service: GptPluginService) {
  }

  @Get('.well-known/ai-plugin.json')
  public async aiPluginJson(@Req() req: Request): Promise<unknown> {
    return this.service.getManifest(req);
  }

  @Get('plugins/:slug/openapi')
  public async pluginOpenApi(@Req() req: Request, @Param('slug') slug: string): Promise<unknown> {
    const spec = await this.service.getOpenApiSpec(req.hostname, slug);
    return spec;
  }

  @UseGuards(PolyKeyGuard)
  @Get('plugins/:slug')
  public async pluginGet(@Req() req: AuthRequest, @Param('slug') slug): Promise<unknown> {
    const plugin = await this.service.getPlugin(slug);
    return {
      plugin: plugin,
      plugin_url: `https://${plugin.slug}.${req.hostname}`,
    };
  }

  @UseGuards(PolyKeyGuard)
  @Post('plugins')
  public async pluginCreateOrUpdate(@Req() req: AuthRequest, @Body() body: CreatePluginDto): Promise<unknown> {
    const plugin = await this.service.createOrUpdatePlugin(req.user.environment, body);
    return {
      plugin: plugin,
      plugin_url: `https://${plugin.slug}.${req.hostname}`,
    };
  }
}
