import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import semver from 'semver';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

type VersionSatisfiesOpts = {

  /**
   * Version range
   */
  value: string;

  /**
   * Specifies a header name that must be present to force version validation wherever `VersionSatisfies` is being used.
   */
  headerTriggerName?: string;
}

/**
 * Guard for forcing clients to send a specific version through header `X-Version`.
 * If `headerTriggerName` is not specified and `X-Version` header is not set by client, this guard will throw a 403 error.
 * If `headerTriggerName` is specified, and nor of `X-Version` and `headerTriggerName` are  sent by the client, this guard will skip version validation.
 * This case is useful when you want to test the route (or controller routes) with Postman, and the same time validate them against client version.
 */
export const VersionSatisfies = Reflector.createDecorator<VersionSatisfiesOpts>();

/**
 * Tool to skip version validation in certain handlers if `VersionSatisfies` is used at controller level.
 */
export const SkipVersionCheck = Reflector.createDecorator();

export const ERROR_CODE = 'WRONG_CLIENT_VERSION';

@Injectable()
export class VersionGuard implements CanActivate {
  private logger: Logger = new Logger('VersionSatisfies');

  constructor(private reflector: Reflector) {

  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const skipVersionCheck = this.reflector.get(SkipVersionCheck, context.getHandler());

    const request = context.switchToHttp().getRequest() as Request;

    const {
      value: versionRange,
      headerTriggerName,
    } = this.reflector.getAllAndOverride(VersionSatisfies, [context.getHandler(), context.getClass()]);

    if (skipVersionCheck || !versionRange || (headerTriggerName && !request.headers[headerTriggerName])) {
      return true;
    }

    if (!semver.validRange(versionRange)) {
      this.logger.error('Invalid min version format configured in server side.');
      throw new BadRequestException('Invalid server version format.');
    }

    const clientVersion = request.headers['x-version'] as string | undefined;

    if (clientVersion && !semver.valid(clientVersion)) {
      this.logger.error('Invalid version format sent from client side.');
      throw new BadRequestException('Invalid client version format.');
    }

    if (!semver.satisfies(clientVersion as string, versionRange)) {
      throw new ForbiddenException({
        code: ERROR_CODE,
        message: `Current "X-Version" header does not satisfy version range constraint (${versionRange})`,
      });
    }

    return true;
  }
}
