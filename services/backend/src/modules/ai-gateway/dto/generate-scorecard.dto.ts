import { IsArray, IsNumber, IsString } from 'class-validator';

/** Loose shapes — validated in ScorecardService */
export class GenerateScorecardDto {
  @IsArray()
  transcript_segments!: { text: string; speaker?: string; timestamp?: string }[];

  @IsArray()
  suggestions!: { suggestion_type: string; content: string }[];

  @IsNumber()
  talk_ratio_user!: number;

  @IsString()
  mode!: string;
}
