import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidIntervalTimeException extends HttpException {
  constructor(minimumIntervalTimeBetweenExecutions: number) {
    super(`You cannot configure an interval time lower than ${minimumIntervalTimeBetweenExecutions} minutes`, HttpStatus.BAD_REQUEST);
  }
}
