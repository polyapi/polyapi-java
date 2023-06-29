import { getFnMock, TypedMock } from '../utils/test-utils';
import { EventService } from 'event/event.service';

export default {
  getEventError: getFnMock<EventService['getEventError']>(),
  sendErrorEvent: getFnMock<EventService['sendErrorEvent']>(),
  sendVariableUpdateEvent: getFnMock<EventService['sendVariableUpdateEvent']>(),
} as TypedMock<EventService>;
