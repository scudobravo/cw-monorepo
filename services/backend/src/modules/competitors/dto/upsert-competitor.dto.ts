import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpsertCompetitorDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  win_points?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lose_points?: string[];

  @IsString()
  positioning!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trap_questions?: string[];

  @IsIn(['RingWise', 'DevOracle'])
  product!: 'RingWise' | 'DevOracle';
}
