import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  DefaultValuePipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateUserPlanDto } from './dto/update-user-plan.dto';
import { UpdateUserTokensDto } from './dto/update-user-tokens.dto';
import { UpdatePlanLimitsDto } from './dto/update-plan-limits.dto';

@Controller('admin/api')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ── Stats ────────────────────────────────────────────────────

  @Get('stats')
  stats() {
    return this.admin.getStats();
  }

  // ── Users ────────────────────────────────────────────────────

  @Get('users')
  users(
    @Query('product') product?: string,
    @Query('plan') plan?: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit = 25,
  ) {
    return this.admin.listUsers({ product, plan, search, page, limit });
  }

  @Get('users/:id')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getUser(id);
  }

  /** Change plan — DB trigger auto-updates tokens_limit and resets tokens_used */
  @Patch('users/:id/plan')
  updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPlanDto,
  ) {
    return this.admin.updateUserPlan(id, dto.plan);
  }

  /** Override token limit for a specific user (ignores plan default) */
  @Patch('users/:id/tokens')
  updateTokens(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserTokensDto,
  ) {
    return this.admin.updateUserTokens(id, dto.tokens_limit);
  }

  /** Reset tokens_used to 0 and extend reset_at by 1 month */
  @Post('users/:id/reset-usage')
  resetUsage(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.resetUserUsage(id);
  }

  /** Cancel Stripe subscription immediately + downgrade to free */
  @Post('users/:id/cancel-subscription')
  cancelSubscription(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.cancelUserSubscription(id);
  }

  // ── Plans ────────────────────────────────────────────────────

  @Get('plans')
  listPlans() {
    return this.admin.listPlans();
  }

  /** Update plan limits — propagates tokens_monthly to all users on that plan */
  @Patch('plans/:id')
  updatePlanLimits(
    @Param('id') id: string,
    @Body() dto: UpdatePlanLimitsDto,
  ) {
    return this.admin.updatePlan(id, dto);
  }

  // ── Sessions ─────────────────────────────────────────────────

  @Get('sessions')
  sessions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
    @Query('product') product?: string,
    @Query('mode') mode?: string,
  ) {
    const l = Math.min(100, limit);
    return this.admin.listSessions({ page, limit: l, product, mode });
  }

  // ── Question Bank ─────────────────────────────────────────────

  @Get('question-bank')
  questionBank() {
    return this.admin.listQuestionBank();
  }

  @Get('question-bank/:id')
  questionOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getQuestion(id);
  }

  @Delete('question-bank/:id')
  deleteQuestion(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.deleteQuestion(id);
  }
}
