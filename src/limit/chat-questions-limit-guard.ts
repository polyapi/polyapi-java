import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AuthRequest } from 'common/types';
import { LimitService } from 'limit/limit.service';

@Injectable()
export class ChatQuestionsLimitGuard implements CanActivate {
  constructor(
    private readonly limitService: LimitService,
  ) {
  }

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (!request.user) {
      return false;
    }

    const { user: { tenant } } = request as AuthRequest;

    if (!await this.limitService.checkTenantChatQuestionsLimit(tenant)) {
      throw new HttpException('You have reached your limit of questions. Try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
