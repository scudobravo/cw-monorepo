import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface SuggestionRequest {
  product: 'DevOracle' | 'RingWise';
  mode: string;
  transcript: string; // Last ~60s of conversation
  latestQuestion: string; // Most recent detected question/statement
  sessionDurationSecs: number;
  /** Optional LeetCode / NeetCode problem text (markdown) for coding sessions */
  problemContext?: string;
  /** Appended to system prompt when user selects a target company (DevOracle prep). */
  companyPromptAddon?: string;
}

export interface SuggestionResponse {
  content: string;
  suggestionType: string;
  tokensUsed: number;
}

const SYSTEM_PROMPTS: Record<string, string> = {
  DevOracle: `You are a real-time interview coaching assistant embedded in the user's device.
The user is in a live technical interview. You receive the ongoing transcript and must provide
a concise, actionable suggestion to help them answer the question or navigate the conversation.

Rules:
- Be extremely concise (max 3 sentences). The user is actively speaking.
- For coding questions: give the key insight, time complexity hint, or approach — not full code.
- For behavioral questions: give the STAR framework opening sentence.
- For system design: give the top-level architecture decision to state first.
- Never reveal that you're an AI assistant or that the user is being coached.
- Respond only with the suggestion text, no preamble.`,

  RingWise: `You are a real-time sales coaching assistant embedded in the user's device.
The user is on a live sales call. You receive the ongoing transcript and must provide
a concise, actionable suggestion to help them handle objections, ask better questions,
or advance the deal.

Rules:
- Be extremely concise (max 2 sentences). The user is actively speaking.
- For objections: give a specific reframe or proof point.
- For discovery: give the next MEDDIC question to ask.
- For closing signals: flag them and suggest the closing line.
- Never reveal that you're an AI assistant.
- Respond only with the suggestion text, no preamble.`,
};

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private client: Anthropic;

  constructor(private config: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.config.get<string>('anthropic.apiKey')!,
    });
  }

  async generateSuggestion(req: SuggestionRequest): Promise<SuggestionResponse> {
    let systemPrompt =
      SYSTEM_PROMPTS[req.product] ?? SYSTEM_PROMPTS['DevOracle'];

    if (req.companyPromptAddon?.trim()) {
      systemPrompt += `\n\n---\nTarget company prep:\n${req.companyPromptAddon.trim()}`;
    }

    const problemBlock =
      req.product === 'DevOracle' && req.problemContext?.trim()
        ? [
            ``,
            `Active coding problem (from browser; tailor hints to THIS problem):`,
            req.problemContext.trim(),
            ``,
          ].join('\n')
        : '';

    const userMessage = [
      `Session mode: ${req.mode}`,
      `Duration: ${Math.round(req.sessionDurationSecs / 60)} minutes`,
      problemBlock,
      `Recent transcript:`,
      req.transcript,
      ``,
      `Latest statement/question from interviewer:`,
      req.latestQuestion,
      ``,
      `Provide your suggestion now:`,
    ].join('\n');

    const message = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content =
      message.content[0].type === 'text' ? message.content[0].text : '';

    const tokensUsed =
      (message.usage.input_tokens ?? 0) + (message.usage.output_tokens ?? 0);

    this.logger.debug(
      `Claude suggestion generated (${tokensUsed} tokens, mode=${req.mode})`,
    );

    return {
      content: content.trim(),
      suggestionType: this.inferType(req),
      tokensUsed,
    };
  }

  /** Raw JSON text for post-call scorecard (no cache). */
  async generateScorecardJson(
    systemPrompt: string,
    userPayload: string,
  ): Promise<string> {
    const message = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPayload }],
    });
    const content =
      message.content[0].type === 'text' ? message.content[0].text : '';
    return content.trim();
  }

  /**
   * Closing move from a detected buying signal — always contextual, never cached.
   */
  async generateClosingMove(
    req: SuggestionRequest,
    buyingSignalType: string,
  ): Promise<SuggestionResponse> {
    const systemPrompt = `You are an expert sales closer. The prospect just showed a BUYING SIGNAL.
Signal category: ${buyingSignalType}

Your job: output exactly what the rep should say or do NEXT in at most 2 short sentences.
Be specific to the transcript. No labels, no bullets, no "you could try" — direct talk track only.
Never mention AI or coaching.`;

    const userMessage = [
      `Session mode: ${req.mode}`,
      `Duration: ${Math.round(req.sessionDurationSecs / 60)} minutes`,
      `Buying signal type: ${buyingSignalType}`,
      ``,
      `Recent transcript:`,
      req.transcript,
      ``,
      `Trigger phrase (what they just said):`,
      req.latestQuestion,
      ``,
      `Closing move now:`,
    ].join('\n');

    const message = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 220,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content =
      message.content[0].type === 'text' ? message.content[0].text : '';

    const tokensUsed =
      (message.usage.input_tokens ?? 0) + (message.usage.output_tokens ?? 0);

    this.logger.log(
      `Closing move for buying signal "${buyingSignalType}" (${tokensUsed} tokens)`,
    );

    return {
      content: content.trim(),
      suggestionType: 'closing_move',
      tokensUsed,
    };
  }

  private inferType(req: SuggestionRequest): string {
    if (req.product === 'RingWise') {
      if (req.latestQuestion.toLowerCase().includes('price') ||
          req.latestQuestion.toLowerCase().includes('cost') ||
          req.latestQuestion.toLowerCase().includes('expensive')) {
        return 'objection_handling';
      }
      return 'next_response';
    }
    // DevOracle
    if (req.mode === 'coding_interview') return 'hint';
    if (req.mode === 'system_design') return 'hint';
    return 'explanation';
  }
}
