export class LogDto {
  id: string;
  date: Date;
  level: string;
  message: string;
  context: string | null;
  entityType: string | null;
  entityId: string | null;
}
