import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SuggestionRequest, SuggestionResponse } from './claude.service';

const FLASH_SYSTEM_PROMPTS: Record<string, string> = {
  DevOracle: `You are a real-time interview coaching assistant. The user is in a live technical interview.
Give a concise, actionable suggestion (max 3 sentences). No preamble, no labels.
For coding: key insight or approach hint only — no full code.
For behavioral: STAR opening sentence.
For system design: top-level architecture decision to state first.`,

  RingWise: `You are a real-time sales coaching assistant. The user is on a live sales call.
Give a concise, actionable suggestion (max 2 sentences). No preamble, no labels.
For objections: specific reframe or proof point.
For discovery: next MEDDIC question to ask.
For closing signals: flag them and suggest the closing line.`,
};

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;

  constructor(private config: ConfigService) {
    this.genAI = new GoogleGenerativeAI(
      this.config.get<string>('gemini.apiKey')!,
    );
  }

  /**
   * Transcribe a base64-encoded PCM audio chunk (16kHz mono f32).
   * Returns the transcribed text, or empty string on failure.
   */
  async transcribeAudio(audioBase64: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
      });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'audio/wav',
            data: audioBase64,
          },
        },
        'Transcribe this audio exactly as spoken. Return only the transcription, no punctuation corrections or additions.',
      ]);

      return result.response.text().trim();
    } catch (err) {
      this.logger.warn(`Transcription failed: ${(err as Error).message}`);
      return '';
    }
  }

  /**
   * Generate a real-time coaching suggestion using Gemini 2.0 Flash.
   * Used for standard (non-company-specific) live suggestions — very fast and nearly free.
   */
  async generateSuggestion(req: SuggestionRequest): Promise<SuggestionResponse> {
    const systemInstruction =
      FLASH_SYSTEM_PROMPTS[req.product] ?? FLASH_SYSTEM_PROMPTS['DevOracle'];

    const problemBlock =
      req.product === 'DevOracle' && req.problemContext?.trim()
        ? `\nActive coding problem:\n${req.problemContext.trim()}\n`
        : '';

    const prompt = [
      systemInstruction,
      '',
      `Session mode: ${req.mode}`,
      `Duration: ${Math.round(req.sessionDurationSecs / 60)} minutes`,
      problemBlock,
      `Recent transcript:`,
      req.transcript,
      '',
      `Latest statement/question:`,
      req.latestQuestion,
      '',
      'Provide your suggestion:',
    ].join('\n');

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const content = result.response.text().trim();

    this.logger.debug(`Gemini Flash suggestion (mode=${req.mode}): ${content.slice(0, 80)}…`);

    return {
      content,
      suggestionType: this.inferType(req),
      tokensUsed: 0, // Gemini SDK doesn't expose token counts in this call path
    };
  }

  /**
   * Generate a text embedding vector using Gemini text-embedding-004.
   * Returns a 768-dimension float array.
   */
  async embedText(text: string): Promise<number[]> {
    const model = this.genAI.getGenerativeModel({
      model: 'text-embedding-004',
    });

    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  private inferType(req: SuggestionRequest): string {
    if (req.product === 'RingWise') {
      const lower = req.latestQuestion.toLowerCase();
      if (lower.includes('price') || lower.includes('cost') || lower.includes('expensive')) {
        return 'objection_handling';
      }
      return 'next_response';
    }
    if (req.mode === 'coding_interview') return 'hint';
    if (req.mode === 'system_design') return 'hint';
    return 'explanation';
  }
}
