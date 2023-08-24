import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AuthRequest } from 'common/types';
import { LimitService } from 'limit/limit.service';

@Injectable()
export class FunctionCallsLimitGuard implements CanActivate {
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

    if (!await this.limitService.checkTenantFunctionCallsLimit(tenant)) {
      throw new HttpException('You have reached your limit of function calls per day. Try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
