export class TriggerDto {
  id: string;
  name: string;
  environmentId: string;
  source: TriggerSource;
  destination: TriggerDestination;
  waitForResponse: boolean;
}

export class TriggerSource {
  webhookHandleId?: string;
  serverFunctionId?: string;
}

export class TriggerDestination {
  serverFunctionId?: string;
}
