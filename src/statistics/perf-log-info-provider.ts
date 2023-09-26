import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class PerfLogInfoProvider {
  snippet: string | undefined = undefined;
  data: Record<string, any> | undefined = undefined;
}
