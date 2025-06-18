import { IsString, IsNumber, IsPositive } from 'class-validator';

export class CalculateRewardsDto {
  @IsString()
  incentiveId: string;

  @IsNumber()
  @IsPositive()
  tokenId: number;
}
