import { Controller, Post, Get, UseGuards, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import type { User } from '@supabase/supabase-js';
import { IsString } from 'class-validator';

class VerifyTokenDto {
  @IsString()
  token!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /** Desktop app calls this on startup to verify a stored token is still valid. */
  @Post('verify')
  async verify(@Body() dto: VerifyTokenDto) {
    const user = await this.auth.verifyToken(dto.token);
    if (!user) return { valid: false };
    return { valid: true, userId: user.id, email: user.email };
  }

  /** Returns the current user profile (requires valid Bearer token). */
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async me(@CurrentUser() user: User) {
    const profile = await this.auth.getOrCreateProfile(
      user.id,
      user.email ?? '',
    );
    return { user, profile };
  }
}
