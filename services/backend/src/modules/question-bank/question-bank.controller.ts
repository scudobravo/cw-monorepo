import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QuestionBankService } from './question-bank.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { IsOptional, IsString, IsNumberString } from 'class-validator';

class TopQuestionsQuery {
  @IsOptional() @IsString()
  product?: string;

  @IsOptional() @IsString()
  mode?: string;

  @IsOptional() @IsNumberString()
  limit?: string;
}

@Controller('question-bank')
@UseGuards(SupabaseAuthGuard)
export class QuestionBankController {
  constructor(private qb: QuestionBankService) {}

  /** Get the most frequently asked questions (for History page). */
  @Get('top')
  async top(@Query() query: TopQuestionsQuery) {
    return this.qb.getTopQuestions({
      product: query.product,
      mode: query.mode,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    });
  }
}
