import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { RewardService } from '../services/reward.service';

@Controller('rewards')
export class RewardController {
  constructor(private readonly rewardService: RewardService) {}

  @Get('pending/:userAddress')
  async getPendingRewards(@Param('userAddress') userAddress: string) {
    return this.rewardService.getPendingRewards(userAddress);
  }

  @Get('position/:positionId/incentive/:incentiveId')
  async calculateRewards(
    @Param('positionId') positionId: string,
    @Param('incentiveId') incentiveId: string,
  ) {
    return this.rewardService.calculateRewards(positionId, incentiveId);
  }
}
