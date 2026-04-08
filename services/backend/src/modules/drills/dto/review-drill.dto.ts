import { IsInt, Max, Min } from 'class-validator';

export class ReviewDrillDto {
  @IsInt()
  @Min(0)
  @Max(5)
  quality!: 0 | 1 | 2 | 3 | 4 | 5;
}
