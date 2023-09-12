import { TriggerDestination, TriggerDto, TriggerSource } from '@poly/model';

export interface TriggerProvider {
  init: () => Promise<void>;
  findTriggerById: (environmentId: string, id: string) => Promise<TriggerDto | null>;
  getTriggers: (environmentId?: string) => Promise<TriggerDto[]>;
  createTrigger: (
    environmentId: string,
    name: string | null,
    source: TriggerSource,
    destination: TriggerDestination,
    waitForResponse: boolean
  ) => Promise<TriggerDto>;
  deleteTrigger: (environmentId: string, trigger: TriggerDto) => Promise<void>;
  triggerEvent: (executionId: string, source: TriggerSource, eventPayload: any) => Promise<void>;
}
