import { Body, Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { AuthRequest } from 'common/types';

@Controller('auth-test')
export class AuthTestController {
  @UseGuards(PolyAuthGuard)
  @Get()
  async testRequest(@Req() req: AuthRequest, @Body() data: any) {
    return {
      user: req.user,
      data,
    };
  }
}
