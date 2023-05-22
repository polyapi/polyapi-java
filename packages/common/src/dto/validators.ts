import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'NoContainDots '})
export class NotContainDots implements ValidatorConstraintInterface {
  validate(value: any): boolean | Promise<boolean> {
    return /^[^.]*$/.test(value);
  }

  defaultMessage(): string {
    return '"$value" cannot have dots inside.';
  }
}