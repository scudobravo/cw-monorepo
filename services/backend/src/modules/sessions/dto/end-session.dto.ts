import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class EndSessionDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  duration_secs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  total_suggestions?: number;

  @IsOptional()
  @IsNumber()
  talk_ratio_user?: number;

  @IsOptional()
  @IsString()
  recap?: string;

  @IsOptional()
  @IsObject()
  scorecard?: Record<string, unknown>;
}
