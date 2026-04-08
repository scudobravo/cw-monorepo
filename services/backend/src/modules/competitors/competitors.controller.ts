import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CompetitorsService } from './competitors.service';
import { UpsertCompetitorDto } from './dto/upsert-competitor.dto';

@Controller('admin/api/competitors')
export class CompetitorsController {
  constructor(private readonly competitors: CompetitorsService) {}

  @Get()
  list(@Query('product') product?: string) {
    return this.competitors.findAll(product);
  }

  @Post()
  upsert(@Body() dto: UpsertCompetitorDto) {
    return this.competitors.upsert(dto);
  }
}
