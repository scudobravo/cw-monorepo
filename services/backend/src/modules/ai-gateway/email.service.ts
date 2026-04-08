import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClaudeService } from './claude.service';
import { SessionsService } from '../sessions/sessions.service';
import type { Session } from '../sessions/sessions.entity';
import type { FollowUpEmailDto } from './dto/follow-up-email.dto';

const SYSTEM_PROMPT = `You are an expert B2B sales writer. Based on this sales call transcript,
write a professional follow-up email.

Rules:
- Subject line: specific, references something said in the call
- Opening: reference a specific moment from the call (not generic "great talking to you")
- Body: summarize 1-2 key pain points discussed, how the product addresses them
- Next step: specific date/time if mentioned in call, otherwise propose one
- Closing: warm but professional
- Length: max 150 words
- Tone: confident, consultative, not pushy

Return JSON: { "subject": "...", "body": "..." }`;

function parseJsonObject(raw: string): unknown {
  let t = raw.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '');
    const fence = t.lastIndexOf('```');
    if (fence !== -1) t = t.slice(0, fence).trim();
  }
  return JSON.parse(t);
}

function parseEmailPayload(raw: unknown): { subject: string; body: string } {
  if (!raw || typeof raw !== 'object') {
    throw new BadRequestException('Invalid email JSON shape');
  }
  const o = raw as Record<string, unknown>;
  const subject = typeof o.subject === 'string' ? o.subject.trim() : '';
  const body = typeof o.body === 'string' ? o.body.trim() : '';
  if (!subject || !body) {
    throw new BadRequestException('Email JSON must include non-empty subject and body');
  }
  return { subject, body };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly claude: ClaudeService,
    private readonly sessions: SessionsService,
  ) {}

  /**
   * Generates a follow-up email from session context (scorecard, recap, optional transcript).
   * Persists to `sessions.follow_up_email`. Returns cached copy if already generated.
   */
  async generateFollowUpEmail(
    sessionId: string,
    userId: string,
    dto?: FollowUpEmailDto,
  ): Promise<{ subject: string; body: string }> {
    const session = await this.sessions.findOne(sessionId, userId);
    const existing = session.follow_up_email;
    if (existing?.subject && existing?.body) {
      return { subject: existing.subject, body: existing.body };
    }

    const userPayload = this.buildUserPayload(session, dto);
    const rawText = await this.claude.generateScorecardJson(
      SYSTEM_PROMPT,
      userPayload,
    );

    let parsed: unknown;
    try {
      parsed = parseJsonObject(rawText);
    } catch (e) {
      this.logger.warn(`Follow-up email JSON parse failed: ${e}`);
      throw new BadRequestException('Model returned invalid JSON');
    }

    const { subject, body } = parseEmailPayload(parsed);
    const generatedAt = new Date().toISOString();

    await this.sessions.updateFollowUpEmail(sessionId, userId, {
      subject,
      body,
      generated_at: generatedAt,
    });

    return { subject, body };
  }

  private buildUserPayload(session: Session, dto?: FollowUpEmailDto): string {
    const lines: string[] = [];
    lines.push(`Session mode: ${session.mode}`);
    lines.push(`Product: ${session.product}`);
    if (session.duration_secs != null) {
      lines.push(
        `Duration: ${Math.round(session.duration_secs / 60)} minutes`,
      );
    }
    if (session.scorecard && typeof session.scorecard === 'object') {
      lines.push('');
      lines.push('Call context (scorecard and summary):');
      lines.push(JSON.stringify(session.scorecard, null, 2));
    }
    if (session.recap?.trim()) {
      lines.push('');
      lines.push('Session recap:');
      lines.push(session.recap.trim());
    }
    if (dto?.transcript_segments?.length) {
      lines.push('');
      lines.push('Transcript excerpts:');
      for (const seg of dto.transcript_segments) {
        const sp = seg.speaker ? `[${seg.speaker}] ` : '';
        lines.push(`${sp}${seg.text}`);
      }
    }

    return lines.join('\n');
  }
}
