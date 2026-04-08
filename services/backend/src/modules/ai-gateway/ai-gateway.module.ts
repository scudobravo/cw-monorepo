import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { ClaudeService } from './claude.service';
import { InferenceService } from './inference.service';
import { TranscriptionGateway } from './transcription.gateway';
import { ScorecardService } from './scorecard.service';
import { ScorecardController } from './scorecard.controller';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { AuthModule } from '../auth/auth.module';
import { QuestionBankModule } from '../question-bank/question-bank.module';
import { SessionsModule } from '../sessions/sessions.module';
import { CompetitorsModule } from '../competitors/competitors.module';
import { BuyingSignalsModule } from '../buying-signals/buying-signals.module';
import { ProblemsModule } from '../problems/problems.module';
import { CompaniesModule } from '../companies/companies.module';
import { InterviewScorecardService } from './interview-scorecard.service';
import { InterviewScorecardController } from './interview-scorecard.controller';

@Module({
  imports: [
    AuthModule,
    QuestionBankModule,
    SessionsModule,
    CompetitorsModule,
    BuyingSignalsModule,
    ProblemsModule,
    CompaniesModule,
  ],
  controllers: [ScorecardController, EmailController, InterviewScorecardController],
  providers: [
    GeminiService,
    ClaudeService,
    InferenceService,
    TranscriptionGateway,
    ScorecardService,
    EmailService,
    InterviewScorecardService,
  ],
  exports: [
    GeminiService,
    ClaudeService,
    InferenceService,
    ScorecardService,
    EmailService,
    InterviewScorecardService,
  ],
})
export class AiGatewayModule {}
