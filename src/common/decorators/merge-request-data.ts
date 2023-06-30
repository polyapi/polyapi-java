import { merge } from 'lodash';

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type RequestDataType = 'body' | 'headers' | 'query' | 'params';

/**
 * Decorator to merge request data, it can be useful if you need to validate different types of request data within same dto class.
 * It starts from left to right for data merging and it uses `merge` fn from `lodash` to merge.
 */
export const MergeRequestData = createParamDecorator<RequestDataType[]>((requestTypes: RequestDataType[] = ['body'], ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();

  const firstRequestType = requestTypes[0];

  if (!firstRequestType) {
    return {};
  }

  return requestTypes.slice(1).reduce((acum, value) => {
    return merge(acum, request[value]);
  }, request[firstRequestType] || {});
});
