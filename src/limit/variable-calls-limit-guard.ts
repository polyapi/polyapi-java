import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AuthRequest } from 'common/types';
import { LimitService } from 'limit/limit.service';
import { VARIABLE_CALLS_LIMIT_REACHED } from '@poly/common/messages';

@Injectable()
export class VariableCallsLimitGuard implements CanActivate {
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

    if (!await this.limitService.checkTenantVariableCallsLimit(tenant)) {
      throw new HttpException(VARIABLE_CALLS_LIMIT_REACHED, HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
