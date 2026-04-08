import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class TranscriptSegmentEmailDto {
  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  speaker?: string;
}

export class FollowUpEmailDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptSegmentEmailDto)
  transcript_segments?: TranscriptSegmentEmailDto[];
}
