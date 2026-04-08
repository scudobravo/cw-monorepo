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
import { GenerateScorecardDto } from './dto/generate-scorecard.dto';
import { ScorecardService } from './scorecard.service';

@Controller('sessions')
@UseGuards(SupabaseAuthGuard)
export class ScorecardController {
  constructor(private readonly scorecard: ScorecardService) {}

  @Post(':id/scorecard')
  async generate(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateScorecardDto,
  ) {
    return this.scorecard.generateAndPersist(id, user.id, dto);
  }
}
