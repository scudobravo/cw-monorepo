import { Injectable } from '@nestjs/common';

export interface StoredProblemContext {
  title: string;
  difficulty: string;
  markdown: string;
}

/** In-memory problem text for active WS sessions (key = DB session id). */
@Injectable()
export class SessionProblemContextService {
  private readonly map = new Map<string, StoredProblemContext>();

  set(sessionId: string, ctx: StoredProblemContext): void {
    this.map.set(sessionId, ctx);
  }

  get(sessionId: string): StoredProblemContext | null {
    return this.map.get(sessionId) ?? null;
  }

  delete(sessionId: string): void {
    this.map.delete(sessionId);
  }
}
