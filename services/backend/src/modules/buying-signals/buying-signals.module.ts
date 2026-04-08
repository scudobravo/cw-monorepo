import { Module } from '@nestjs/common';
import { BuyingSignalsService } from './buying-signals.service';

@Module({
  providers: [BuyingSignalsService],
  exports: [BuyingSignalsService],
})
export class BuyingSignalsModule {}
