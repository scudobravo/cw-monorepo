import { Controller, Get, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { UsageService } from './usage.service';
import type { User } from '@supabase/supabase-js';

@Controller('usage')
@UseGuards(SupabaseAuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  getUsage(@CurrentUser() user: User) {
    return this.usageService.getUsage(user.id);
  }
}
