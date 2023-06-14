import { FunctionArgument } from '@poly/common';

export const compareArgumentsByRequired = (a: FunctionArgument, b: FunctionArgument) => {
  if (a.required && !b.required) {
    return -1;
  }
  if (!a.required && b.required) {
    return 1;
  }
  return 0;
};
