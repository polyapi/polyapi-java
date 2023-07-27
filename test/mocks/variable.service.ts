import { getFnMock, TypedMock } from '../utils/test-utils';
import { VariableService } from 'variable/variable.service';

export default {
  getAll: getFnMock<VariableService['getAll']>(),
  toServerVariableSpecification: getFnMock<VariableService['toServerVariableSpecification']>(),
  findByPath: getFnMock<VariableService['findByPath']>(),
  findById: getFnMock<VariableService['findById']>(),
  getVariableValue: getFnMock<VariableService['getVariableValue']>(),
  createVariable: getFnMock<VariableService['createVariable']>(),
  updateVariable: getFnMock<VariableService['updateVariable']>(),
  deleteVariable: getFnMock<VariableService['deleteVariable']>(),
  toDto: getFnMock<VariableService['toDto']>(),
  unwrapVariables: getFnMock<VariableService['unwrapVariables']>().mockImplementation((authData, value) => Promise.resolve(value)),
} as TypedMock<VariableService>;
