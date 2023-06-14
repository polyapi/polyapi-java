import { Strategy } from 'passport-http-bearer';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from 'auth/auth.service';

@Injectable()
export class PolyAuthStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(PolyAuthStrategy.name);

  constructor(
    private readonly authService: AuthService,
  ) {
    super(
      async (apiKey: string, done) => {
        try {
          const authData = await authService.getAuthData(apiKey);

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
