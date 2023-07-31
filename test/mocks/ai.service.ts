import { getFnMock, TypedMock } from '../utils/test-utils';
import { AiService } from 'ai/ai.service';

export default {
  getVariableDescription: getFnMock<AiService['getVariableDescription']>(),
  pluginChat: getFnMock(),
} as TypedMock<AiService>;
