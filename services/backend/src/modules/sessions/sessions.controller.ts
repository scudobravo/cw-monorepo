import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import type { User } from '@supabase/supabase-js';
import { CreateSessionDto } from './dto/create-session.dto';
import { EndSessionDto } from './dto/end-session.dto';

@Controller('sessions')
@UseGuards(SupabaseAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  async list(
    @CurrentUser() user: User,
    @Query('product') product?: string,
  ) {
    return this.sessions.findByUser(user.id, product);
  }

  @Get(':id')
  async one(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sessions.findOne(id, user.id);
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateSessionDto) {
    return this.sessions.create(user.id, dto);
  }

  @Patch(':id/end')
  async end(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndSessionDto,
  ) {
    return this.sessions.end(id, user.id, dto);
  }
}
