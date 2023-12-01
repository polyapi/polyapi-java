import { EventService } from '../event.service';

type OmitLastParameter<T extends any[]> = T extends readonly [ ...infer FirstParameters, any ] ? FirstParameters : never[];

export interface EmitterEvents {
    sendWebhookEvent(...params: OmitLastParameter<Parameters<EventService['sendWebhookEvent']>>): void
    sendAuthFunctionEvent(...params: OmitLastParameter<Parameters<EventService['sendAuthFunctionEvent']>>): void
    sendVariableChangeEvent(...params: OmitLastParameter<Parameters<EventService['sendVariableChangeEvent']>>): void
    sendErrorEvent(...params: OmitLastParameter<Parameters<EventService['sendErrorEvent']>>): void;
};
