import { Module } from '@nestjs/common';
import { SecretService } from './secret.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [SecretService],
  exports: [SecretService],
})
export class SecretModule {
}
