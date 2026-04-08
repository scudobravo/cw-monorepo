import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DrillsService } from './drills.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import type { User } from '@supabase/supabase-js';
import { CreateDrillCardDto } from './dto/create-drill-card.dto';
import { ReviewDrillDto } from './dto/review-drill.dto';

@Controller('drills')
@UseGuards(SupabaseAuthGuard)
export class DrillsController {
  constructor(private readonly drills: DrillsService) {}

  @Get('due')
  async due(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Math.min(50, Math.max(1, parseInt(limit, 10) || 10)) : 10;
    const items = await this.drills.getDueCards(user.id, n);
    return { items };
  }

  @Get('ahead')
  async ahead(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Math.min(50, Math.max(1, parseInt(limit, 10) || 10)) : 10;
    const items = await this.drills.getAheadCards(user.id, n);
    return { items };
  }

  @Get('stats')
  async stats(@CurrentUser() user: User) {
    return this.drills.getStats(user.id);
  }

  @Post('cards')
  async addCard(@CurrentUser() user: User, @Body() dto: CreateDrillCardDto) {
    return this.drills.addCard(user.id, dto.question_id);
  }

  @Post('cards/:id/review')
  async review(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDrillDto,
  ) {
    return this.drills.reviewCard(user.id, id, dto.quality);
  }
}
