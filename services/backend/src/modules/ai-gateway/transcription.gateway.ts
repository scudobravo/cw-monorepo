import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { GeminiService } from './gemini.service';
import { InferenceService } from './inference.service';
import { AuthService } from '../auth/auth.service';
import { SessionsService } from '../sessions/sessions.service';
import type { SessionProduct } from '../sessions/sessions.entity';
import type { EndSessionDto } from '../sessions/dto/end-session.dto';
import { CompetitorsService } from '../competitors/competitors.service';
import { ClaudeService } from './claude.service';
import { BuyingSignalsService } from '../buying-signals/buying-signals.service';
import { SessionProblemContextService } from '../problems/session-problem-context.service';
import { CompaniesService } from '../companies/companies.service';
import { UsageService } from '../usage/usage.service';
import {
  type VocalMetrics,
  computeRollingWpm,
  countFillerInText,
  wpmStatus,
} from './vocal-metrics.util';

export type BuyingSignalType =
  | 'timeline'
  | 'pricing'
  | 'trial'
  | 'authority'
  | 'enthusiasm'
  | 'comparison';

const BUYING_SIGNALS: Record<BuyingSignalType, string[]> = {
  timeline: ['when can we start', 'how long does onboarding', 'how quickly', 'timeline'],
  pricing: ['how much', 'what does it cost', 'pricing', "what's the price", 'budget'],
  trial: ['can we try', 'free trial', 'pilot', 'proof of concept', 'poc'],
  authority: ['i need to talk to', 'let me check with my', "i'll run it by"],
  enthusiasm: ['this is exactly', 'this solves', 'we need this', 'i love this'],
  comparison: ['better than', 'compared to', 'versus', ' vs ', ' vs.'],
};

const BUYING_SIGNAL_ORDER: BuyingSignalType[] = [
  'timeline',
  'pricing',
  'trial',
  'authority',
  'enthusiasm',
  'comparison',
];

/** First phrase match wins; longer phrases checked first within each category. */
export function detectBuyingSignals(text: string): BuyingSignalType | null {
  const lower = text.toLowerCase();
  for (const type of BUYING_SIGNAL_ORDER) {
    const phrases = [...BUYING_SIGNALS[type]].sort((a, b) => b.length - a.length);
    for (const p of phrases) {
      if (lower.includes(p.toLowerCase())) {
        return type;
      }
    }
  }
  return null;
}

interface SessionMeta {
  userId: string;
  /** Product for inference / question bank (unchanged) */
  wsProduct: 'DevOracle' | 'RingWise';
  mode: string;
  dbSessionId: string;
  transcriptBuffer: string[];
  startedAt: number;
  suggestionCount: number;
  ended: boolean;
  /** Wall-clock ms of last transcript segment (talk-ratio heuristic). */
  lastTranscriptAt: number | null;
  /** Start of current conversational turn (ms). */
  turnStartAt: number | null;
  userWords: number;
  otherWords: number;
  /** competitor id -> last emit time (ms) for cooldown */
  competitorLastEmitAt: Record<string, number>;
  /** buying signal type -> last emit time (ms) */
  buyingSignalCooldown: Record<string, number>;
  /** Vocal coaching (DevOracle only) */
  lastEmittedSegmentAt: number | null;
  fillerCountSession: number;
  silenceTimer: ReturnType<typeof setTimeout> | null;
  userWpmWindow: Array<{ at: number; words: number }>;
  wpmSumForAvg: number;
  wpmSampleCount: number;
  /** Claude system prompt fragment from companies.system_prompt_addon */
  companyPromptAddon: string | null;
}

/** Emitted with each `transcript_segment` WebSocket event. */
export interface CompetitorDetectedPayload {
  id: string;
  name: string;
  win_points: string[];
  lose_points: string[];
  positioning: string;
  trap_questions: string[];
}

export interface TranscriptSegmentPayload {
  text: string;
  speaker: 'user' | 'other';
  word_count: number;
  session_word_counts: { user: number; other: number };
  talk_ratio_user: number;
  timestamp: string;
  competitor_detected?: CompetitorDetectedPayload;
  vocal_metrics?: VocalMetrics;
}

const TURN_GAP_MS = 1500;
const USER_WINDOW_MS = 3000;
const COMPETITOR_COOLDOWN_MS = 120_000;
const BUYING_SIGNAL_COOLDOWN_MS = 60_000;

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

interface StartSessionMessage {
  token: string;
  product: 'DevOracle' | 'RingWise';
  mode: string;
  /** Optional: company slug (e.g. google) for targeted system prompt */
  company_slug?: string;
}

interface AudioChunkMessage {
  /** Base64-encoded WAV audio (16kHz, mono, f32-le) */
  audio: string;
}

interface EndSessionMessage {
  token: string;
  duration_secs?: number;
  recap?: string;
  scorecard?: Record<string, unknown>;
  talk_ratio_user?: number;
}

function wsProductToDb(
  p: 'DevOracle' | 'RingWise',
): SessionProduct {
  return p === 'DevOracle' ? 'DevOracle' : 'RingWise';
}

@WebSocketGateway({ path: '/transcription' })
export class TranscriptionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TranscriptionGateway.name);
  private sessions = new Map<WebSocket, SessionMeta>();

  constructor(
    private gemini: GeminiService,
    private inference: InferenceService,
    private auth: AuthService,
    private sessionsService: SessionsService,
    private competitorsService: CompetitorsService,
    private claude: ClaudeService,
    private buyingSignals: BuyingSignalsService,
    private sessionProblemContext: SessionProblemContextService,
    private companiesService: CompaniesService,
    private usageService: UsageService,
  ) {}

  handleConnection(client: WebSocket) {
    this.logger.log('Client connected');
    client.send(JSON.stringify({ event: 'connected', data: { ok: true } }));
  }

  handleDisconnect(client: WebSocket) {
    const meta = this.sessions.get(client);
    if (meta?.silenceTimer) {
      clearTimeout(meta.silenceTimer);
      meta.silenceTimer = null;
    }
    if (meta && !meta.ended && meta.dbSessionId) {
      void this.finalizeSession(meta, {
        duration_secs: Math.round((Date.now() - meta.startedAt) / 1000),
        total_suggestions: meta.suggestionCount,
      });
    }
    this.sessions.delete(client);
    this.logger.log('Client disconnected');
  }

  /** Step 1 — Desktop calls this right after connecting, with its Supabase token. */
  @SubscribeMessage('start_session')
  async onStartSession(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() payload: StartSessionMessage,
  ) {
    const user = await this.auth.verifyToken(payload.token);
    if (!user) {
      client.send(JSON.stringify({ event: 'error', data: { message: 'Unauthorized' } }));
      client.close();
      return;
    }

    const allowed = await this.usageService.checkLimit(user.id);
    if (!allowed) {
      client.send(JSON.stringify({
        event: 'usage_limit',
        data: { message: 'Monthly token limit reached. Upgrade your plan to continue.' },
      }));
      client.close();
      return;
    }

    let row;
    try {
      row = await this.sessionsService.create(user.id, {
        product: wsProductToDb(payload.product),
        mode: payload.mode,
      });
    } catch (e) {
      this.logger.error('sessionsService.create failed', e);
      client.send(
        JSON.stringify({
          event: 'error',
          data: { message: 'Could not persist session' },
        }),
      );
      return;
    }

    let companyPromptAddon: string | null = null;
    if (payload.company_slug?.trim()) {
      const co = await this.companiesService.findBySlug(payload.company_slug);
      companyPromptAddon = co?.system_prompt_addon ?? null;
    }

    this.sessions.set(client, {
      userId: user.id,
      wsProduct: payload.product,
      mode: payload.mode,
      dbSessionId: row.id,
      transcriptBuffer: [],
      startedAt: Date.now(),
      suggestionCount: 0,
      ended: false,
      lastTranscriptAt: null,
      turnStartAt: null,
      userWords: 0,
      otherWords: 0,
      competitorLastEmitAt: {},
      buyingSignalCooldown: {},
      lastEmittedSegmentAt: null,
      fillerCountSession: 0,
      silenceTimer: null,
      userWpmWindow: [],
      wpmSumForAvg: 0,
      wpmSampleCount: 0,
      companyPromptAddon,
    });

    this.logger.log(
      `Session started — user=${user.id}, dbSession=${row.id}, wsProduct=${payload.product}, mode=${payload.mode}`,
    );

    client.send(
      JSON.stringify({
        event: 'session_ready',
        data: { ok: true, sessionId: row.id },
      }),
    );
  }

  /** Optional — explicit end with summary (recap, etc.) */
  @SubscribeMessage('end_session')
  async onEndSession(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() payload: EndSessionMessage,
  ) {
    const user = await this.auth.verifyToken(payload.token);
    if (!user) {
      client.send(JSON.stringify({ event: 'error', data: { message: 'Unauthorized' } }));
      return;
    }

    const meta = this.sessions.get(client);
    if (!meta || meta.userId !== user.id) {
      client.send(JSON.stringify({ event: 'error', data: { message: 'No active session' } }));
      return;
    }

    await this.finalizeSession(meta, {
      duration_secs: payload.duration_secs,
      total_suggestions: meta.suggestionCount,
      recap: payload.recap,
      scorecard: payload.scorecard,
      talk_ratio_user: payload.talk_ratio_user,
    });

    client.send(JSON.stringify({ event: 'session_ended', data: { ok: true } }));
  }

  /** Step 2 — Desktop streams audio chunks continuously. */
  @SubscribeMessage('audio_chunk')
  async onAudioChunk(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() payload: AudioChunkMessage,
  ) {
    const session = this.sessions.get(client);
    if (!session) return;

    const text = await this.gemini.transcribeAudio(payload.audio);
    if (!text) return;

    this.logger.debug(`Transcript chunk: "${text}"`);

    const now = Date.now();
    const gap =
      session.lastTranscriptAt === null
        ? Number.POSITIVE_INFINITY
        : now - session.lastTranscriptAt;
    if (gap > TURN_GAP_MS) {
      session.turnStartAt = now;
    }
    session.lastTranscriptAt = now;
    const turnStart = session.turnStartAt ?? now;
    const inUserWindow = now - turnStart <= USER_WINDOW_MS;
    const speaker: 'user' | 'other' = inUserWindow ? 'user' : 'other';
    const word_count = countWords(text);
    if (speaker === 'user') {
      session.userWords += word_count;
    } else {
      session.otherWords += word_count;
    }
    const totalWords = session.userWords + session.otherWords;
    const talk_ratio_user =
      totalWords > 0 ? (session.userWords / totalWords) * 100 : 0;

    let segmentPayload: TranscriptSegmentPayload = {
      text,
      speaker,
      word_count,
      session_word_counts: {
        user: session.userWords,
        other: session.otherWords,
      },
      talk_ratio_user,
      timestamp: new Date().toISOString(),
    };

    if (session.wsProduct === 'DevOracle') {
      const silenceSeconds =
        session.lastEmittedSegmentAt !== null
          ? (now - session.lastEmittedSegmentAt) / 1000
          : 0;

      if (session.silenceTimer) {
        clearTimeout(session.silenceTimer);
        session.silenceTimer = null;
      }

      const fillerSeg = countFillerInText(text);
      session.fillerCountSession += fillerSeg;

      let wpm = 0;
      if (speaker === 'user') {
        session.userWpmWindow.push({ at: now, words: word_count });
        session.userWpmWindow = session.userWpmWindow.filter((x) => x.at >= now - 60_000);
        wpm = computeRollingWpm(session.userWpmWindow, now);
        if (wpm > 0) {
          session.wpmSumForAvg += wpm;
          session.wpmSampleCount += 1;
        }
      } else {
        wpm = computeRollingWpm(session.userWpmWindow, now);
      }

      const vm: VocalMetrics = {
        filler_count_session: session.fillerCountSession,
        filler_count_segment: fillerSeg,
        words_per_minute: Math.round(wpm * 10) / 10,
        wpm_status: wpmStatus(wpm),
        silence_seconds: Math.round(silenceSeconds * 10) / 10,
      };
      segmentPayload = { ...segmentPayload, vocal_metrics: vm };

      session.lastEmittedSegmentAt = now;

      session.silenceTimer = setTimeout(() => {
        const s = this.sessions.get(client);
        if (!s || s.ended || s.dbSessionId !== session.dbSessionId) return;
        const gapSec = s.lastEmittedSegmentAt
          ? (Date.now() - s.lastEmittedSegmentAt) / 1000
          : 0;
        if (gapSec < 11.5) return;
        try {
          if (client.readyState === 1) {
            client.send(
              JSON.stringify({
                event: 'silence_detected',
                data: {
                  duration_secs: Math.round(gapSec * 10) / 10,
                  suggested_action: 'Think out loud — share your approach',
                },
              }),
            );
          }
        } catch {
          /* ignore */
        }
      }, 12_000);
    }

    if (session.wsProduct === 'RingWise') {
      const comp = await this.competitorsService.detectInText(text, 'RingWise');
      if (comp) {
        const now = Date.now();
        const last = session.competitorLastEmitAt[comp.id] ?? 0;
        if (now - last >= COMPETITOR_COOLDOWN_MS) {
          segmentPayload = {
            ...segmentPayload,
            competitor_detected: {
              id: comp.id,
              name: comp.name,
              win_points: comp.win_points ?? [],
              lose_points: comp.lose_points ?? [],
              positioning: comp.positioning,
              trap_questions: comp.trap_questions ?? [],
            },
          };
          session.competitorLastEmitAt[comp.id] = now;
        }
      }
    }

    client.send(
      JSON.stringify({
        event: 'transcript_segment',
        data: segmentPayload,
      }),
    );

    session.transcriptBuffer.push(text);
    if (session.transcriptBuffer.length > 30) {
      session.transcriptBuffer.shift();
    }

    const transcriptCtx = session.transcriptBuffer.slice(-10).join(' ');
    const sessionDurationSecs = Math.round((Date.now() - session.startedAt) / 1000);

    let skipQuestionInfer = false;

    if (session.wsProduct === 'RingWise') {
      const sig = detectBuyingSignals(text);
      if (sig) {
        const last = session.buyingSignalCooldown[sig] ?? 0;
        if (Date.now() - last >= BUYING_SIGNAL_COOLDOWN_MS) {
          try {
            await this.buyingSignals.insert({
              session_id: session.dbSessionId,
              signal_type: sig,
              trigger_text: text,
            });
            const closing = await this.claude.generateClosingMove(
              {
                product: session.wsProduct,
                mode: session.mode,
                transcript: transcriptCtx,
                latestQuestion: text,
                sessionDurationSecs,
              },
              sig,
            );
            if (closing.content) {
              session.suggestionCount += 1;
              session.buyingSignalCooldown[sig] = Date.now();
              skipQuestionInfer = true;
              this.usageService.track(session.userId, closing.tokensUsed).catch(() => {});
              client.send(
                JSON.stringify({
                  event: 'suggestion',
                  data: {
                    id: crypto.randomUUID(),
                    content: closing.content,
                    suggestionType: 'closing_move',
                    source: 'ai',
                    timestamp: new Date().toISOString(),
                    priority: 'high',
                    buying_signal_type: sig,
                  },
                }),
              );
            }
          } catch (e) {
            this.logger.warn(`Buying signal / closing_move failed: ${e}`);
          }
        }
      }
    }

    if (!skipQuestionInfer && this.looksLikeQuestion(text)) {
      const prob = this.sessionProblemContext.get(session.dbSessionId);
      const result = await this.inference.infer({
        product: session.wsProduct,
        mode: session.mode,
        transcript: transcriptCtx,
        latestQuestion: text,
        sessionDurationSecs,
        problemContext: prob?.markdown,
        companyPromptAddon: session.companyPromptAddon ?? undefined,
      });

      if (result.content) {
        session.suggestionCount += 1;
        this.usageService.track(session.userId, result.tokensUsed).catch(() => {});
        client.send(
          JSON.stringify({
            event: 'suggestion',
            data: {
              id: crypto.randomUUID(),
              content: result.content,
              suggestionType: result.suggestionType,
              source: result.source,
              timestamp: new Date().toISOString(),
            },
          }),
        );
      }
    }
  }

  private async finalizeSession(meta: SessionMeta, summary: EndSessionDto) {
    if (meta.ended) return;
    if (meta.silenceTimer) {
      clearTimeout(meta.silenceTimer);
      meta.silenceTimer = null;
    }
    this.sessionProblemContext.delete(meta.dbSessionId);
    try {
      const duration =
        summary.duration_secs ??
        Math.round((Date.now() - meta.startedAt) / 1000);

      const baseSc =
        summary.scorecard && typeof summary.scorecard === 'object'
          ? { ...summary.scorecard }
          : {};
      if (meta.wsProduct === 'DevOracle') {
        const avgWpm =
          meta.wpmSampleCount > 0
            ? Math.round(meta.wpmSumForAvg / meta.wpmSampleCount)
            : 0;
        Object.assign(baseSc, {
          vocal_coaching: {
            avg_wpm: avgWpm,
            filler_words_total: meta.fillerCountSession,
          },
        });
      }

      await this.sessionsService.end(meta.dbSessionId, meta.userId, {
        duration_secs: duration,
        total_suggestions: summary.total_suggestions ?? meta.suggestionCount,
        recap: summary.recap,
        scorecard: baseSc,
        talk_ratio_user: summary.talk_ratio_user,
      });
      meta.ended = true;
      this.logger.log(`Session ended in DB: ${meta.dbSessionId}`);
    } catch (e) {
      this.logger.error(`Failed to end session ${meta.dbSessionId}`, e);
    }
  }

  private looksLikeQuestion(text: string): boolean {
    const lower = text.toLowerCase().trim();
    if (lower.endsWith('?')) return true;

    const triggers = [
      'tell me', 'explain', 'how would you', 'what would you',
      'describe', 'walk me through', 'can you', 'could you',
      'what is your', 'what are your', 'have you ever',
      'why did you', 'what do you think', 'how do you',
      'what approach', 'what strategy', 'what experience',
      'handle objection', 'too expensive', 'not right now',
      'already have', 'need to think',
    ];

    return triggers.some((t) => lower.includes(t));
  }
}
