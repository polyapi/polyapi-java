import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from 'auth/auth.service';

@Injectable()
export class PolyKeyStrategy extends PassportStrategy(HeaderAPIKeyStrategy) {
  private readonly logger = new Logger(PolyKeyStrategy.name);

  constructor(
    private readonly authService: AuthService,
  ) {
    super(
      { header: 'X-PolyApiKey', prefix: '' },
      false,
      async (polyKey, done) => {
        try {
          const authData = await authService.getAuthData(polyKey);

          if (authData) {
            done(null, authData);
          } else {
            done(null, false);
          }
        } catch (e) {
          done(e);
        }
      },
    );
  }
}
