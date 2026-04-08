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
import { GenerateInterviewScorecardDto } from './dto/generate-interview-scorecard.dto';
import { InterviewScorecardService } from './interview-scorecard.service';

@Controller('sessions')
@UseGuards(SupabaseAuthGuard)
export class InterviewScorecardController {
  constructor(private readonly interviewScorecard: InterviewScorecardService) {}

  @Post(':id/interview-scorecard')
  async generate(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateInterviewScorecardDto,
  ) {
    return this.interviewScorecard.generateAndPersist(id, user.id, dto);
  }
}
