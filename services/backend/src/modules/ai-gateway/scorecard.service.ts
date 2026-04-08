import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ClaudeService } from './claude.service';
import { SessionsService } from '../sessions/sessions.service';
import { BuyingSignalsService } from '../buying-signals/buying-signals.service';
import type { GenerateScorecardDto } from './dto/generate-scorecard.dto';

export interface CallScorecard {
  overall_score: number;
  talk_ratio_score: number;
  objections_handled: number;
  objections_total: number;
  buying_signals_detected: number;
  next_step_established: boolean;
  strengths: string[];
  improvements: string[];
  recommended_action: string;
  call_summary: string;
}

export interface ScorecardTranscriptSegment {
  text: string;
  speaker?: string;
  timestamp?: string;
}

export interface ScorecardSuggestion {
  suggestion_type: string;
  content: string;
}

const NEXT_STEP_PATTERNS = [
  'follow up',
  'follow-up',
  'next week',
  'next call',
  'schedule',
  'calendar',
  'book a',
  'send the',
  'proposal by',
  'next steps',
  'circle back',
  'touch base',
];

function detectNextStepInText(blob: string): boolean {
  const lower = blob.toLowerCase();
  return NEXT_STEP_PATTERNS.some((p) => lower.includes(p));
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

@Injectable()
export class ScorecardService {
  private readonly logger = new Logger(ScorecardService.name);

  constructor(
    private readonly claude: ClaudeService,
    private readonly sessions: SessionsService,
    private readonly buyingSignals: BuyingSignalsService,
  ) {}

  async generateScorecard(
    transcript: ScorecardTranscriptSegment[],
    suggestions: ScorecardSuggestion[],
    talkRatio: number,
    mode: string,
    buyingSignalsDetected: number,
  ): Promise<CallScorecard> {
    const transcriptText = transcript
      .map(
        (s) =>
          `${(s.speaker ?? 'unknown').toUpperCase()}: ${s.text}`,
      )
      .join('\n');

    const suggestionsText = suggestions
      .map(
        (s) => `[${s.suggestion_type}] ${s.content}`,
      )
      .join('\n');

    const objectionRelated = suggestions.filter((s) =>
      /objection|pricing|handle/i.test(s.suggestion_type),
    );

    const systemPrompt = `You are an expert B2B sales coach. Analyze this sales call transcript and
generate a structured scorecard. Be honest and specific. Focus on actionable
insights. Return ONLY valid JSON (no markdown fences, no commentary).

Required JSON keys (all must be present):
- overall_score: integer 1-10
- talk_ratio_score: integer 1-10 (calibrate from rep talk ratio; discovery often ~30-45% user talk; demo higher)
- objections_handled: non-negative integer
- objections_total: non-negative integer (must be >= objections_handled)
- buying_signals_detected: integer, MUST be exactly ${buyingSignalsDetected}
- next_step_established: boolean (true if a concrete follow-up or next step was agreed)
- strengths: array of 2-3 short strings
- improvements: array of 2-3 short strings
- recommended_action: single string — concrete next action for the rep
- call_summary: string, 2-3 sentences

Rules:
- Set buying_signals_detected to ${buyingSignalsDetected} exactly.
- Calibrate talk_ratio_score using talk ratio ${talkRatio.toFixed(1)}% and mode ${mode}.
- If transcript is very short, still produce good-faith estimates.`;

    const userPayload = [
      `Mode: ${mode}`,
      `Talk ratio (user words %): ${talkRatio.toFixed(1)}`,
      `AI cues count: ${suggestions.length} (objection-related cues: ${objectionRelated.length})`,
      ``,
      `TRANSCRIPT:`,
      transcriptText || '(empty)',
      ``,
      `AI SUGGESTIONS DELIVERED:`,
      suggestionsText || '(none)',
    ].join('\n');

    const raw = await this.claude.generateScorecardJson(systemPrompt, userPayload);
    let parsed: Record<string, unknown>;
    try {
      parsed = parseJsonObject(raw) as Record<string, unknown>;
    } catch (e) {
      this.logger.error(`Scorecard JSON parse failed: ${e}`);
      throw new BadRequestException('Could not parse scorecard from model');
    }

    const blobForNextStep = `${transcriptText}\n${suggestionsText}`;
    const keywordNext = detectNextStepInText(blobForNextStep);

    const scorecard: CallScorecard = {
      overall_score: clamp(Number(parsed.overall_score) || 5, 1, 10),
      talk_ratio_score: clamp(Number(parsed.talk_ratio_score) || 5, 1, 10),
      objections_handled: Math.max(0, Math.floor(Number(parsed.objections_handled) || 0)),
      objections_total: Math.max(0, Math.floor(Number(parsed.objections_total) || 0)),
      buying_signals_detected: buyingSignalsDetected,
      next_step_established: Boolean(parsed.next_step_established) || keywordNext,
      strengths: Array.isArray(parsed.strengths)
        ? (parsed.strengths as unknown[]).map(String).slice(0, 5)
        : [],
      improvements: Array.isArray(parsed.improvements)
        ? (parsed.improvements as unknown[]).map(String).slice(0, 5)
        : [],
      recommended_action: String(parsed.recommended_action ?? '').trim() || 'Book a concrete follow-up with a date.',
      call_summary: String(parsed.call_summary ?? '').trim() || 'Recap unavailable.',
    };

    if (scorecard.objections_total < scorecard.objections_handled) {
      scorecard.objections_total = scorecard.objections_handled;
    }

    return scorecard;
  }

  async generateAndPersist(
    sessionId: string,
    userId: string,
    dto: GenerateScorecardDto,
  ) {
    const session = await this.sessions.findOne(sessionId, userId);
    if (session.product !== 'RingWise') {
      throw new BadRequestException('Scorecard is only available for RingWise sessions');
    }

    const buyingCount = await this.buyingSignals.countBySession(sessionId);

    const card = await this.generateScorecard(
      dto.transcript_segments,
      dto.suggestions,
      dto.talk_ratio_user,
      dto.mode,
      buyingCount,
    );

    const updated = await this.sessions.updateScorecard(sessionId, userId, {
      ...card,
    } as unknown as Record<string, unknown>);

    return { session: updated, scorecard: card };
  }
}
