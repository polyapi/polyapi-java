import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

export const NAME_ALLOWED_CHARACTERS_PATTERN = /[^\w|\s|\-]/ig;
export const CONTEXT_ALLOWED_CHARACTERS_PATTERN = /[^\w|\.]/ig;
export const NUMBERS_AT_BEGINNING_PATTERN = /^\d+/g;
export const DOTS_AT_BEGINNING_PATTERN = /^\.+/g;
export const DOTS_AT_END_PATTERN = /\.+$/g;

@ValidatorConstraint({ name: 'NameIdentifier' })
export class NameIdentifier implements ValidatorConstraintInterface {
  validate(value: any): boolean | Promise<boolean> {
    if (typeof value !== 'string') {
      return false;
    }

    const trimmedValue = value.trim();

    return !(trimmedValue.match(NAME_ALLOWED_CHARACTERS_PATTERN) || trimmedValue.match(NUMBERS_AT_BEGINNING_PATTERN));
  }

  defaultMessage(): string {
    return '"$value" identifier cannot have numbers at the beginning and cannot have characters that are not letters, numbers or underscores.';
  }
}

@ValidatorConstraint({ name: 'ContextIdentifier ' })
export class ContextIdentifier implements ValidatorConstraintInterface {
  validate(value: any): boolean | Promise<boolean> {
    const trimmedValue = value.trim();

    return !(
      trimmedValue.match(CONTEXT_ALLOWED_CHARACTERS_PATTERN) ||
      trimmedValue.match(NUMBERS_AT_BEGINNING_PATTERN) ||
      trimmedValue.match(DOTS_AT_BEGINNING_PATTERN) ||
      trimmedValue.match(DOTS_AT_END_PATTERN)
    );
  }

  defaultMessage(): string {
    return '"$value" context cannot have numbers or dots at the beginning, cannot have characters that are not letters, numbers, underscores and cannot have dots at the end.';
  }
}
