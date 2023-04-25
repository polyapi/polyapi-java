import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@poly/common';
import { AuthData } from 'common/types';

@Injectable()
export class PolyKeyGuard extends AuthGuard('headerapikey') {
  constructor(private readonly roles: Role[] | null = null) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const result = (await super.canActivate(context)) as boolean;
    if (!result) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    if (!request.user) {
      return false;
    }

    const { user } = request.user as AuthData;
    if (this.roles && (!user || !this.roles.includes(user.role as Role))) {
      return false;
    }

    return true;
  }
}
