import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  root() {
    return {
      status: 'ok',
      service: 'Savant Backend',
      version: '0.1.0',
      endpoints: {
        auth: 'POST /api/auth/verify · GET /api/auth/me',
        sessions: 'GET /api/sessions',
        questionBank: 'GET /api/question-bank/top',
        websocket: 'WS /transcription',
      },
    };
  }

  @Get('health')
  health() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
