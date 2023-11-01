import { FunctionService } from 'function/function.service';

import { getFnMock, TypedMock } from '../utils/test-utils';

export default {
  getApiFunctions: getFnMock<FunctionService['getApiFunctions']>(),
  getCustomFunctions: getFnMock<FunctionService['getCustomFunctions']>(),
  toApiFunctionSpecification: getFnMock<FunctionService['toApiFunctionSpecification']>(),
  toCustomFunctionSpecification: getFnMock<FunctionService['toCustomFunctionSpecification']>(),
  getFunctionsWithVariableArgument: getFnMock<FunctionService['getFunctionsWithVariableArgument']>(),
  createOrUpdateServerFunction: getFnMock<FunctionService['createOrUpdateServerFunction']>(),
  customServerFunctionResponseDto: getFnMock<FunctionService['customServerFunctionResponseDto']>(),
} as TypedMock<FunctionService>;
