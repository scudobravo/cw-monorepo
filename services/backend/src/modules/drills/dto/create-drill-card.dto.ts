import { IsUUID } from 'class-validator';

export class CreateDrillCardDto {
  @IsUUID()
  question_id!: string;
}
