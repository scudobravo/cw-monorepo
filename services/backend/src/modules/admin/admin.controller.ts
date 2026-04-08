import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin/api')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.getStats();
  }

  @Get('users')
  users(
    @Query('product') product?: string,
    @Query('search') search?: string,
  ) {
    return this.admin.listUsers({ product, search });
  }

  @Get('sessions')
  sessions(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('product') product?: string,
    @Query('mode') mode?: string,
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    return this.admin.listSessions({
      page: p,
      limit: l,
      product,
      mode,
    });
  }

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
