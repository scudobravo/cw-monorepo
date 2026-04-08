import { IsInt, Min } from 'class-validator';

export class UpdateUserTokensDto {
  @IsInt()
  @Min(0)
  tokens_limit!: number;
}
