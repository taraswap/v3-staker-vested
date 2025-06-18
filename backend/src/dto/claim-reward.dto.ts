import { IsString, IsNumber, IsPositive } from 'class-validator';

export class ClaimRewardDto {
  @IsString()
  incentiveId: string;

  @IsNumber()
  @IsPositive()
  tokenId: number;

  @IsString()
  userAddress: string;
}
