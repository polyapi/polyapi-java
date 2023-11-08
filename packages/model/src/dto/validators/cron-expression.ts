import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import * as cronValidator from 'cron-validator';

@ValidatorConstraint({ name: 'CronIdentifier' })
export class CronExpression implements ValidatorConstraintInterface {
  validate(value: any): boolean | Promise<boolean> {
    if (typeof value !== 'string') {
      return false;
    }

    return cronValidator.isValidCron(value, { seconds: true });
  }

  defaultMessage(): string {
    return '"$value" is not a valid cron expression.';
  }
}
