import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class InterviewTranscriptSegmentDto {
  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  speaker?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class InterviewSuggestionDto {
  @IsString()
  suggestion_type!: string;

  @IsString()
  content!: string;
}

export class GenerateInterviewScorecardDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewTranscriptSegmentDto)
  transcript_segments!: InterviewTranscriptSegmentDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewSuggestionDto)
  suggestions!: InterviewSuggestionDto[];

  @IsString()
  mode!: string;

  @IsOptional()
  @IsNumber()
  questions_attempted?: number;

  @IsOptional()
  @IsNumber()
  questions_solved?: number;

  @IsOptional()
  @IsNumber()
  hints_used?: number;
}
