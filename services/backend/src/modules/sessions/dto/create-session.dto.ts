import { IsIn, IsString } from 'class-validator';
import type { SessionProduct } from '../sessions.entity';

export class CreateSessionDto {
  @IsIn(['DevOracle', 'RingWise'])
  product!: SessionProduct;

  @IsString()
  mode!: string;
}
