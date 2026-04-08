import { IsIn } from 'class-validator';

export class UpdateUserPlanDto {
  @IsIn(['free', 'pro', 'team'])
  plan!: 'free' | 'pro' | 'team';
}
