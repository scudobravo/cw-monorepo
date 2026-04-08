import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ClaudeService } from './claude.service';
import { SessionsService } from '../sessions/sessions.service';
import type { GenerateInterviewScorecardDto } from './dto/generate-interview-scorecard.dto';

export type ApproachQuality = 'excellent' | 'good' | 'needs_work';
export type EstimatedLevel = 'junior' | 'mid' | 'senior' | 'staff';

export interface InterviewScorecard {
  overall_score: number;
  problem_solving: number;
  code_quality: number;
  communication_clarity: number;
  time_management: number;
  questions_attempted: number;
  questions_solved: number;
  hints_used: number;
  approach_quality: ApproachQuality;
  strengths: string[];
  improvements: string[];
  next_study_topics: string[];
  estimated_level: EstimatedLevel;
  session_summary: string;
}

export interface InterviewTranscriptSegment {
  text: string;
  speaker?: string;
  timestamp?: string;
}

export interface InterviewSuggestion {
  suggestion_type: string;
  content: string;
}

function parseJsonObject(raw: string): unknown {
  let t = raw.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '');
    const fence = t.lastIndexOf('```');
    if (fence !== -1) t = t.slice(0, fence).trim();
  }
  return JSON.parse(t);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const SYSTEM_PROMPT = `You are a senior FAANG engineer conducting a technical interview debrief.
Analyze this coding interview transcript and generate an honest, specific scorecard.
Be direct — candidates need actionable feedback.
Do not inflate scores. Return valid JSON matching the schema exactly (no markdown fences).

Required JSON keys (all must be present):
- overall_score: integer 1-10
- problem_solving: integer 1-10
- code_quality: integer 1-10
- communication_clarity: integer 1-10
- time_management: integer 1-10
- questions_attempted: non-negative integer
- questions_solved: non-negative integer
- hints_used: non-negative integer
- approach_quality: one of "excellent" | "good" | "needs_work"
- strengths: array of 2-3 short specific strings
- improvements: array of 2-3 short specific strings
- next_study_topics: array of 3-5 concrete topics to study
- estimated_level: one of "junior" | "mid" | "senior" | "staff"
- session_summary: string, 2-3 sentences`;

@Injectable()
export class InterviewScorecardService {
  private readonly logger = new Logger(InterviewScorecardService.name);

  constructor(
    private readonly claude: ClaudeService,
    private readonly sessions: SessionsService,
  ) {}

  async generateScorecard(
    transcript: InterviewTranscriptSegment[],
    suggestions: InterviewSuggestion[],
    mode: string,
    stats?: {
      questions_attempted?: number;
      questions_solved?: number;
      hints_used?: number;
    },
  ): Promise<InterviewScorecard> {
    const transcriptText = transcript
      .map((s) => `${(s.speaker ?? 'unknown').toUpperCase()}: ${s.text}`)
      .join('\n');

    const suggestionsText = suggestions
      .map((s) => `[${s.suggestion_type}] ${s.content}`)
      .join('\n');

    const hintish = suggestions.filter(
      (s) =>
        /hint|complexity|approach|edge/i.test(s.suggestion_type) ||
        /hint/i.test(s.content),
    );

    const hintsFallback = stats?.hints_used ?? hintish.length;

    const userPayload = [
      `Mode: ${mode}`,
      stats?.questions_attempted != null
        ? `Client-reported questions attempted: ${stats.questions_attempted}`
        : '',
      stats?.questions_solved != null
        ? `Client-reported questions solved: ${stats.questions_solved}`
        : '',
      `Approx hints / coaching cues (from AI deliveries): ${hintsFallback}`,
      ``,
      `TRANSCRIPT:`,
      transcriptText || '(empty)',
      ``,
      `AI SUGGESTIONS DELIVERED:`,
      suggestionsText || '(none)',
    ]
      .filter(Boolean)
      .join('\n');

    const raw = await this.claude.generateScorecardJson(SYSTEM_PROMPT, userPayload);

    let parsed: Record<string, unknown>;
    try {
      parsed = parseJsonObject(raw) as Record<string, unknown>;
    } catch (e) {
      this.logger.error(`Interview scorecard JSON parse failed: ${e}`);
      throw new BadRequestException('Could not parse interview scorecard from model');
    }

    const aq = String(parsed.approach_quality ?? 'good').toLowerCase();
    const approach_quality: ApproachQuality =
      aq === 'excellent' || aq === 'needs_work' ? (aq as ApproachQuality) : 'good';

    let level = String(parsed.estimated_level ?? 'mid').toLowerCase();
    if (!['junior', 'mid', 'senior', 'staff'].includes(level)) level = 'mid';
    const estimated_level = level as EstimatedLevel;

    const card: InterviewScorecard = {
      overall_score: clamp(Number(parsed.overall_score) || 5, 1, 10),
      problem_solving: clamp(Number(parsed.problem_solving) || 5, 1, 10),
      code_quality: clamp(Number(parsed.code_quality) || 5, 1, 10),
      communication_clarity: clamp(Number(parsed.communication_clarity) || 5, 1, 10),
      time_management: clamp(Number(parsed.time_management) || 5, 1, 10),
      questions_attempted: Math.max(
        0,
        Math.floor(
          Number(parsed.questions_attempted ?? stats?.questions_attempted ?? 0) || 0,
        ),
      ),
      questions_solved: Math.max(
        0,
        Math.floor(
          Number(parsed.questions_solved ?? stats?.questions_solved ?? 0) || 0,
        ),
      ),
      hints_used: Math.max(
        0,
        Math.floor(Number(parsed.hints_used ?? hintsFallback) || 0),
      ),
      approach_quality,
      strengths: Array.isArray(parsed.strengths)
        ? (parsed.strengths as unknown[]).map(String).slice(0, 5)
        : [],
      improvements: Array.isArray(parsed.improvements)
        ? (parsed.improvements as unknown[]).map(String).slice(0, 5)
        : [],
      next_study_topics: Array.isArray(parsed.next_study_topics)
        ? (parsed.next_study_topics as unknown[]).map(String).slice(0, 8)
        : [],
      estimated_level,
      session_summary:
        String(parsed.session_summary ?? '').trim() || 'Session recap unavailable.',
    };

    if (card.questions_solved > card.questions_attempted && card.questions_attempted > 0) {
      card.questions_solved = card.questions_attempted;
    }

    return card;
  }

  async generateAndPersist(sessionId: string, userId: string, dto: GenerateInterviewScorecardDto) {
    const session = await this.sessions.findOne(sessionId, userId);
    if (session.product !== 'DevOracle') {
      throw new BadRequestException('Interview scorecard is only for DevOracle sessions');
    }

    const card = await this.generateScorecard(
      dto.transcript_segments,
      dto.suggestions,
      dto.mode,
      {
        questions_attempted: dto.questions_attempted,
        questions_solved: dto.questions_solved,
        hints_used: dto.hints_used,
      },
    );

    const updated = await this.sessions.updateScorecard(sessionId, userId, {
      ...(card as unknown as Record<string, unknown>),
      _kind: 'interview',
    } as unknown as Record<string, unknown>);

    return { session: updated, scorecard: card };
  }
}
