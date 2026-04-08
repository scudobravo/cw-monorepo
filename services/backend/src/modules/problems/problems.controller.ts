import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import type { User } from '@supabase/supabase-js';
import { SessionsService } from '../sessions/sessions.service';
import { ProblemsService } from './problems.service';
import { SessionProblemContextService } from './session-problem-context.service';
import { SetProblemContextDto } from './dto/set-problem-context.dto';

@Controller('problems')
@UseGuards(SupabaseAuthGuard)
export class ProblemsFetchController {
  constructor(private readonly problems: ProblemsService) {}

  @Get('fetch')
  async fetch(@Query('url') url: string) {
    if (!url?.trim()) {
      throw new BadRequestException('Missing url');
    }
    const ctx = await this.problems.fetchProblem(url.trim());
    return {
      ...ctx,
      markdown: this.problems.toMarkdown(ctx),
    };
  }
}

@Controller('sessions')
@UseGuards(SupabaseAuthGuard)
export class SessionProblemContextController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly store: SessionProblemContextService,
  ) {}

  @Post(':id/problem-context')
  async setContext(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetProblemContextDto,
  ) {
    await this.sessions.findOne(id, user.id);
    this.store.set(id, {
      title: body.title?.trim() || 'Problem',
      difficulty: body.difficulty?.trim() || 'Unknown',
      markdown: body.markdown.trim(),
    });
    return { ok: true };
  }
}
