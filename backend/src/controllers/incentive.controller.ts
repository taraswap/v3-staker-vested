import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { IncentiveService } from '../services/incentive.service';
import { CreateIncentiveDto } from '../dto/create-incentive.dto';
import { CalculateRewardsDto } from '../dto/calculate-rewards.dto';
import { ClaimRewardDto } from '../dto/claim-reward.dto';
import { Incentive } from '../entities/incentive.entity';
import { RewardClaim } from '../entities/reward-claim.entity';

@Controller('incentives')
export class IncentiveController {
  constructor(private readonly incentiveService: IncentiveService) {}

  @Post()
  async createIncentive(
    @Body() createIncentiveDto: CreateIncentiveDto,
  ): Promise<Incentive> {
    return this.incentiveService.createIncentive(createIncentiveDto);
  }

  @Post('calculate-rewards')
  async calculateRewards(
    @Body() calculateRewardsDto: CalculateRewardsDto,
  ): Promise<{ reward: string; maxReward: string }> {
    return this.incentiveService.calculateRewards(calculateRewardsDto);
  }

  @Post('claim')
  async claimReward(
    @Body() claimRewardDto: ClaimRewardDto,
  ): Promise<RewardClaim> {
    return this.incentiveService.claimReward(claimRewardDto);
  }

  @Get(':incentiveId')
  async getIncentive(
    @Param('incentiveId') incentiveId: string,
  ): Promise<Incentive> {
    return this.incentiveService.getIncentive(incentiveId);
  }
}
