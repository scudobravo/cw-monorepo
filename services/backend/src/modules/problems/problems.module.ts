import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ProblemsService } from './problems.service';
import {
  ProblemsFetchController,
  SessionProblemContextController,
} from './problems.controller';
import { SessionProblemContextService } from './session-problem-context.service';

@Module({
  imports: [AuthModule, SessionsModule],
  controllers: [ProblemsFetchController, SessionProblemContextController],
  providers: [ProblemsService, SessionProblemContextService],
  exports: [ProblemsService, SessionProblemContextService],
})
export class ProblemsModule {}
