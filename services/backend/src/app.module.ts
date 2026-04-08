import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { QuestionBankModule } from './modules/question-bank/question-bank.module';
import { UsersModule } from './modules/users/users.module';
import { HealthController } from './health.controller';
import { AdminModule } from './modules/admin/admin.module';
import { CompetitorsModule } from './modules/competitors/competitors.module';
import { BuyingSignalsModule } from './modules/buying-signals/buying-signals.module';
import { DrillsModule } from './modules/drills/drills.module';
import { CompaniesModule } from './modules/companies/companies.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['../../.env', '.env'],
    }),
    AuthModule,
    UsersModule,
    SessionsModule,
    AiGatewayModule,
    QuestionBankModule,
    AdminModule,
    CompetitorsModule,
    BuyingSignalsModule,
    DrillsModule,
    CompaniesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
