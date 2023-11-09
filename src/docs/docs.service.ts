import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DocSection } from '@prisma/client';
import { AiService } from 'ai/ai.service';
import { PrismaService } from 'prisma-module/prisma.service';

export type DocUpdateT = {
  id?: string;
  context?: string;
  title?: string;
  text?: string;
};

@Injectable()
export class DocsService {
  private readonly logger = new Logger(DocsService.name);

  constructor(private readonly prisma: PrismaService, private readonly aiService: AiService) {}

  async getDocList(tenantId: string | null): Promise<DocSection[]> {
    tenantId = await this._processTenantId(tenantId);

    return this.prisma.docSection.findMany({ where: { tenantId } });
  }

  async createOrUpdateDoc(body: DocUpdateT, tenantId: string | null): Promise<DocSection> {
    tenantId = await this._processTenantId(tenantId);

    let doc: DocSection;
    if (typeof body.id === 'string') {
      // check permissions
      let doc = await this.prisma.docSection.findUniqueOrThrow({ where: { id: body.id } });
      if (doc.tenantId !== tenantId) {
        throw new BadRequestException('Permission Denied!');
      }

      const updateData: DocUpdateT = {};
      if (body.title) {
        updateData.title = body.title;
      }
      if (body.text) {
        updateData.text = body.text;
      }
      if (body.context) {
        updateData.context = body.context;
      }
      doc = await this.prisma.docSection.update({
        where: { id: body.id },
        data: updateData,
      });
      return doc;
    } else {
      doc = await this.prisma.docSection.create({
        data: { context: body.context, title: body.title, text: body.text, tenantId },
      });
    }

    return this.aiService.updateDocVector(doc);
  }

  async deleteDoc(id: string, tenantId: string | null) {
    tenantId = await this._processTenantId(tenantId);

    const doc = await this.prisma.docSection.findUniqueOrThrow({ where: { id } });
    if (doc.tenantId !== tenantId) {
      // check permissions
      throw new BadRequestException('Permission Denied!');
    }
    return await this.prisma.docSection.delete({ where: { id } });
  }

  async _processTenantId(tenantId: string | null): Promise<string | null> {
    if (!tenantId) {
      throw new BadRequestException('must have tenant'); // TODO cleanup types so this is unnecessary
    }
    const tenant = await this.prisma.tenant.findFirstOrThrow({ where: { id: tenantId } });
    if (tenant.name === 'poly-system') {
      return null; // hack null is the special indicator of the Poly System Tenant for Now
    } else {
      return tenant.id;
    }
  }
}
