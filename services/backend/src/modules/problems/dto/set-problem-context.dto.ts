import { IsString, MinLength } from 'class-validator';

export class SetProblemContextDto {
  @IsString()
  title!: string;

  @IsString()
  difficulty!: string;

  @IsString()
  @MinLength(1)
  markdown!: string;
}
