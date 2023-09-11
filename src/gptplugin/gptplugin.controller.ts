import {
  Controller,
  Logger,
  Get,
  Post,
  Delete,
  UseGuards,
  Req,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { Request } from 'express';
import { CreatePluginDto, Role } from '@poly/model';
import { GptPluginService, getSlugSubdomain } from 'gptplugin/gptplugin.service';
import { AuthRequest } from 'common/types';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { ChatService } from 'chat/chat.service';

@ApiSecurity('PolyApiKey')
@Controller()
export class GptPluginController {
  private readonly logger = new Logger(GptPluginController.name);

  constructor(private readonly service: GptPluginService, private readonly chatService: ChatService) {}

  @Get('.well-known/ai-plugin.json')
  public async aiPluginJson(@Req() req: Request): Promise<unknown> {
    return this.service.getManifest(req);
  }

  @Get('plugins/:slug/openapi')
  public async pluginOpenApi(@Req() req: Request, @Param('slug') slug: string): Promise<unknown> {
    const spec = await this.service.getOpenApiSpec(req.hostname, slug);
    return spec;
  }

  @UseGuards(PolyAuthGuard)
  @Get('plugins/:slug')
  public async pluginGet(@Req() req: AuthRequest, @Param('slug') slug): Promise<unknown> {
    slug = slug.toLowerCase();
    const plugin = await this.service.getPlugin(slug, req.user.environment.id);
    return {
      plugin,
      plugin_url: `https://${plugin.slug}-${req.user.environment.subdomain}.${req.hostname}`,
      plugin_api_url: `https://${plugin.slug}-${req.user.environment.subdomain}.${req.hostname}/api`,
    };
  }

  @UseGuards(new PolyAuthGuard([Role.Admin, Role.SuperAdmin]))
  @Delete('plugins/:slug')
  public async pluginDelete(@Req() req: AuthRequest, @Param('slug') slug): Promise<unknown> {
    await this.service.deletePlugin(slug, req.user.environment.id);
    return 'deleted';
  }

  @UseGuards(new PolyAuthGuard([Role.Admin, Role.SuperAdmin]))
  @Get('api/conversations/:id')
  public async apiConversationGet(@Req() req: AuthRequest, @Param('id') conversationId: string): Promise<unknown> {
    return this.chatService.getConversationDetail('', conversationId);
  }

  @UseGuards(PolyAuthGuard)
  @Post('api/conversations/:id')
  public async apiConversationPost(@Req() req: AuthRequest, @Param('id') conversationId: string, @Body() body): Promise<unknown> {
    const slug = getSlugSubdomain(req.hostname)[0];
    // for testing locally!
    // const slug = 'megatronical';
    if (!slug) {
      throw new BadRequestException('Slug not found! Please use your plugin subdomain like "foo-1234.na1.polyapi.io".');
    }
    const resp = await this.service.chat(req.user, slug, conversationId, body.message);
    return resp;
  }

  @UseGuards(new PolyAuthGuard([Role.Admin, Role.SuperAdmin]))
  @Delete('api/conversations/:id')
  public async apiConversationDelete(@Req() req: AuthRequest, @Param('id') conversationId: string): Promise<unknown> {
    return this.chatService.deleteConversation(conversationId);
  }

  @UseGuards(PolyAuthGuard)
  @Get('plugins')
  public async pluginList(@Req() req: AuthRequest): Promise<unknown> {
    const plugins = await this.service.listPlugins(req.user.environment.id);
    return plugins.map((plugin) => {
      return {
        plugin,
        plugin_url: `https://${plugin.slug}-${req.user.environment.subdomain}.${req.hostname}`,
        plugin_api_url: `https://${plugin.slug}-${req.user.environment.subdomain}.${req.hostname}/api`,
      };
    });
  }

  @UseGuards(PolyAuthGuard)
  @Post('plugins')
  public async pluginCreateOrUpdate(@Req() req: AuthRequest, @Body() body: CreatePluginDto): Promise<unknown> {
    const plugin = await this.service.createOrUpdatePlugin(req.user.environment, body);
    return {
      plugin,
      plugin_url: `https://${plugin.slug}-${req.user.environment.subdomain}.${req.hostname}`,
      plugin_api_url: `https://${plugin.slug}-${req.user.environment.subdomain}.${req.hostname}/api`,
    };
  }

  @UseGuards(PolyAuthGuard)
  @Get('whoami')
  public async whoami(@Req() req: AuthRequest): Promise<unknown> {
    const user = req.user.user;
    if (user) {
      return {
        userId: user.id,
        tenantId: user.tenantId,
        environmentId: req.user.environment.id,
        environmentSubdomain: req.user.environment.subdomain,
      };
    } else {
      return {
        userId: null,
      };
    }
  }
}
