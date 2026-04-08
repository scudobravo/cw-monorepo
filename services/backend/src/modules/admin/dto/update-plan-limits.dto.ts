import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePlanLimitsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  tokens_monthly?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  price_eur?: number;

  @IsOptional()
  @IsString()
  display_name?: string;
}
