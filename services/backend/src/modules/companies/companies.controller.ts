import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

@Controller('companies')
@UseGuards(SupabaseAuthGuard)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  async list() {
    const items = await this.companies.findAll();
    return { items };
  }

  @Get(':slug')
  async one(@Param('slug') slug: string) {
    return this.companies.getBySlugOrThrow(slug);
  }
}
