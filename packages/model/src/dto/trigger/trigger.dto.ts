export class TriggerDto {
  id: string;
  name: string;
  environmentId: string;
  source: TriggerSource;
  destination: TriggerDestination;
}

export class TriggerSource {
  webhookHandleId?: string;
  serverFunctionId?: string;
}

export class TriggerDestination {
  serverFunctionId?: string;
}
