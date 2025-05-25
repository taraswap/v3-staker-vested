import { IsString, IsNumber, IsPositive } from 'class-validator';

export class JoinIncentiveDto {
  @IsString()
  incentiveId: string;

  @IsNumber()
  @IsPositive()
  tokenId: number;

  @IsString()
  ownerAddress: string;
}
