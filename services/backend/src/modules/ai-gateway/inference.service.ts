import { Injectable, Logger } from '@nestjs/common';
import { ClaudeService, SuggestionRequest } from './claude.service';
import { GeminiService } from './gemini.service';
import { QuestionBankService } from '../question-bank/question-bank.service';

export interface InferenceInput extends SuggestionRequest {}

export interface InferenceResult {
  content: string;
  suggestionType: string;
  source: 'cache' | 'ai';
  tokensUsed: number;
}

@Injectable()
export class InferenceService {
  private readonly logger = new Logger(InferenceService.name);

  constructor(
    private claude: ClaudeService,
    private gemini: GeminiService,
    private questionBank: QuestionBankService,
  ) {}

  async infer(input: InferenceInput): Promise<InferenceResult> {
    const question = input.latestQuestion.trim();
    if (!question) {
      return { content: '', suggestionType: 'hint', source: 'ai', tokensUsed: 0 };
    }

    const embedText =
      input.product === 'DevOracle' && input.problemContext?.trim()
        ? `${question}\n\n${input.problemContext.trim().slice(0, 2000)}`
        : question;

    // ── 1. Generate embedding and check question bank ──────────────
    const embedding = await this.gemini.embedText(embedText);

    const cached = await this.questionBank.findSimilar({
      embedding,
      product: input.product,
      mode: input.mode,
      threshold: 0.92,
    });

    if (cached) {
      this.logger.log(
        `Cache hit (similarity ≥ 0.92) for question: "${question.slice(0, 60)}…"`,
      );
      // Increment usage counter in the background
      this.questionBank.incrementCount(cached.id).catch(() => {});
      return {
        content: cached.answer,
        suggestionType: cached.suggestion_type,
        source: 'cache',
        tokensUsed: 0,
      };
    }

    // ── 2. Cache miss → route to the right model ──────────────────
    // Company-specific prep (companyPromptAddon set) needs more reasoning → Claude Haiku.
    // All other live suggestions → Gemini 2.0 Flash (fast, nearly free).
    const useHaiku = Boolean(input.companyPromptAddon?.trim());

    if (useHaiku) {
      this.logger.log(
        `Cache miss — calling Claude Haiku (company-specific) for: "${question.slice(0, 60)}…"`,
      );
    } else {
      this.logger.log(
        `Cache miss — calling Gemini Flash for: "${question.slice(0, 60)}…"`,
      );
    }

    const result = useHaiku
      ? await this.claude.generateSuggestion(input)
      : await this.gemini.generateSuggestion(input);

    // ── 3. Store in question bank (fire & forget) ──────────────────
    this.questionBank
      .store({
        text: embedText.slice(0, 4000),
        embedding,
        answer: result.content,
        suggestionType: result.suggestionType,
        product: input.product,
        mode: input.mode,
      })
      .catch((err) =>
        this.logger.warn(`Failed to store in question bank: ${err.message}`),
      );

    return {
      content: result.content,
      suggestionType: result.suggestionType,
      source: 'ai',
      tokensUsed: result.tokensUsed,
    };
  }
}
