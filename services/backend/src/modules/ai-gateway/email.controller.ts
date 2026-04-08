import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import type { User } from '@supabase/supabase-js';
import { FollowUpEmailDto } from './dto/follow-up-email.dto';
import { EmailService } from './email.service';

@Controller('sessions')
@UseGuards(SupabaseAuthGuard)
export class EmailController {
  constructor(private readonly email: EmailService) {}

  @Post(':id/follow-up-email')
  async followUpEmail(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FollowUpEmailDto,
  ) {
    return this.email.generateFollowUpEmail(id, user.id, dto);
  }
}
