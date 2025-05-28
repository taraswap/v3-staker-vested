import { Controller, Post, Body, Get, Param, BadRequestException, HttpException } from '@nestjs/common';
import { IncentiveService } from '../services/incentive.service';
import { CreateIncentiveDto } from '../dto/create-incentive.dto';
import { CalculateRewardsDto } from '../dto/calculate-rewards.dto';
import { ClaimRewardDto } from '../dto/claim-reward.dto';
import { Incentive } from '../entities/incentive.entity';
import { RewardClaim } from '../entities/reward-claim.entity';

@Controller('incentives')
export class IncentiveController {
  constructor(private readonly incentiveService: IncentiveService) { }

  @Post()
  async createIncentive(
    @Body() createIncentiveDto: CreateIncentiveDto,
  ): Promise<Incentive> {
    try {
      if (!createIncentiveDto.rewardToken || !createIncentiveDto.poolAddress || !createIncentiveDto.startTime || !createIncentiveDto.endTime || !createIncentiveDto.vestingPeriod || !createIncentiveDto.totalRewardUnclaimed) {
        throw new BadRequestException('Invalid request');
      }
      return await this.incentiveService.createIncentive(createIncentiveDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('calculate-rewards')
  async calculateRewards(
    @Body() calculateRewardsDto: CalculateRewardsDto,
  ): Promise<{ reward: string; maxReward: string }> {
    try {
      if (!calculateRewardsDto.incentiveId || !calculateRewardsDto.tokenId) {
        throw new BadRequestException('Invalid request');
      }
      return this.incentiveService.calculateRewards(calculateRewardsDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('claim')
  async claimReward(
    @Body() claimRewardDto: ClaimRewardDto,
  ): Promise<RewardClaim> {
    try {
      if (!claimRewardDto.userAddress || !claimRewardDto.incentiveId || !claimRewardDto.tokenId) {
        throw new BadRequestException('Invalid request');
      }
      return this.incentiveService.claimReward(claimRewardDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':incentiveId')
  async getIncentive(
    @Param('incentiveId') incentiveId: string,
  ): Promise<Incentive> {
    return this.incentiveService.getIncentive(incentiveId);
  }
}
