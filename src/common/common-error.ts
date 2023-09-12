export const NAME_CONFLICT = 'NAME_CONFLICT';

export class CommonError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
