import { IsString, IsNumber, IsPositive } from 'class-validator';

export class CreateIncentiveDto {
  @IsString()
  poolAddress: string;

  @IsNumber()
  @IsPositive()
  startTime: number;

  @IsNumber()
  @IsPositive()
  endTime: number;

  @IsNumber()
  @IsPositive()
  vestingPeriod: number;

  @IsNumber()
  @IsPositive()
  totalRewardUnclaimed: number;
}
