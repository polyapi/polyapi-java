import { getFnMock, TypedMock } from '../utils/test-utils';
import { VariableService } from 'variable/variable.service';

export default {
  getAll: getFnMock<VariableService['getAll']>(),
  toServerVariableSpecification: getFnMock<VariableService['toServerVariableSpecification']>(),
  findByPath: getFnMock<VariableService['findByPath']>(),
  getVariableValue: getFnMock<VariableService['getVariableValue']>(),
} as TypedMock<VariableService>;
