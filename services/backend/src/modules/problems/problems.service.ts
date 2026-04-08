import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { Browser } from 'puppeteer-core';

export interface ProblemContext {
  title: string;
  description: string;
  difficulty: string;
  examples: string;
  constraints: string;
  sourceUrl: string;
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

@Injectable()
export class ProblemsService {
  private readonly logger = new Logger(ProblemsService.name);

  async fetchProblem(url: string): Promise<ProblemContext> {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    const host = u.hostname.replace(/^www\./, '');
    if (
      !host.includes('leetcode.com') &&
      !host.includes('neetcode.io') &&
      !host.includes('hackerrank.com')
    ) {
      throw new BadRequestException('URL host not supported');
    }

    const html = await this.fetchHtml(url);
    let ctx = this.parseWithCheerio(html, url);

    if ((!ctx.title || ctx.title.length < 2) && process.env.PUPPETEER_EXECUTABLE_PATH) {
      try {
        ctx = await this.parseWithPuppeteer(url);
      } catch (e) {
        this.logger.warn(`Puppeteer fallback failed: ${e}`);
      }
    }

    if (!ctx.title) {
      ctx = {
        ...ctx,
        title: 'Unknown problem',
        description: ctx.description || html.slice(0, 4000),
      };
    }

    return ctx;
  }

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new BadRequestException(`Fetch failed: ${res.status}`);
    }
    return res.text();
  }

  private parseWithCheerio(html: string, sourceUrl: string): ProblemContext {
    const $ = cheerio.load(html);

    let title =
      $('[data-cy="question-title"]').first().text().trim() ||
      $('.text-title-large').first().text().trim() ||
      $('h1, h2, h3').first().text().trim();

    const nextData = $('#__NEXT_DATA__').html();
    if (nextData) {
      try {
        const data = JSON.parse(nextData) as Record<string, unknown>;
        const titleFromJson = this.extractTitleFromNextData(data);
        if (titleFromJson) title = titleFromJson;
      } catch {
        /* ignore */
      }
    }

    let difficulty =
      $('.text-difficulty-easy, .text-difficulty-medium, .text-difficulty-hard')
        .first()
        .text()
        .trim() ||
      $('[diff]').attr('diff') ||
      '';

    if (!difficulty && nextData) {
      try {
        const data = JSON.parse(nextData) as Record<string, unknown>;
        const d = this.extractDifficultyFromNextData(data);
        if (d) difficulty = d;
      } catch {
        /* ignore */
      }
    }

    const body =
      $('.question-content, [data-cy="question-content"], .content__u3I1')
        .first()
        .text()
        .trim() ||
      $('article')
        .first()
        .text()
        .trim()
        .slice(0, 8000);

    const examples =
      $('.example-block, .challenge-sample-io, pre').first().text().trim() || '';

    let constraints = '';
    $('strong').each((_, el) => {
      const t = $(el).text();
      if (/constraints/i.test(t)) {
        constraints = $(el).parent().text().trim().slice(0, 2000);
        return false;
      }
      return undefined;
    });

    return {
      title: title || '',
      description: body || '',
      difficulty: difficulty || 'Unknown',
      examples,
      constraints,
      sourceUrl,
    };
  }

  private extractTitleFromNextData(data: Record<string, unknown>): string | null {
    const str = JSON.stringify(data);
    const m = str.match(/"title":\s*"([^"]+)"/);
    if (m?.[1] && !m[1].includes('LeetCode')) return m[1];
    const m2 = str.match(/"translatedTitle":\s*"([^"]+)"/);
    return m2?.[1] ?? null;
  }

  private extractDifficultyFromNextData(data: Record<string, unknown>): string | null {
    const str = JSON.stringify(data);
    const m = str.match(/"difficulty":\s*"(Easy|Medium|Hard)"/i);
    return m?.[1] ?? null;
  }

  private async parseWithPuppeteer(url: string): Promise<ProblemContext> {
    const execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (!execPath) throw new Error('No PUPPETEER_EXECUTABLE_PATH');

    const puppeteer = await import('puppeteer-core');
    let browser: Browser | undefined;
    try {
      browser = await puppeteer.launch({
        executablePath: execPath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setUserAgent(UA);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45_000 });
      const html = await page.content();
      return this.parseWithCheerio(html, url);
    } finally {
      await browser?.close();
    }
  }

  toMarkdown(p: ProblemContext): string {
    return [
      `# ${p.title}`,
      ``,
      `**Difficulty:** ${p.difficulty}`,
      ``,
      p.description,
      ``,
      p.examples ? `## Examples\n${p.examples}` : '',
      ``,
      p.constraints ? `## Constraints\n${p.constraints}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
}
