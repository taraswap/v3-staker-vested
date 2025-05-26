import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from '../entities/position.entity';
import { Incentive } from '../entities/incentive.entity';
import { Stake } from '../entities/stake.entity';
import { RewardClaim } from '../entities/reward-claim.entity';
import { RewardCalculator } from './reward-calculator.service';

@Injectable()
export class RewardService {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Incentive)
    private incentiveRepository: Repository<Incentive>,
    @InjectRepository(Stake)
    private stakeRepository: Repository<Stake>,
    @InjectRepository(RewardClaim)
    private rewardClaimRepository: Repository<RewardClaim>,
    private rewardCalculator: RewardCalculator,
  ) {}

  async calculateRewards(positionId: string, incentiveId: string) {
    const position = await this.positionRepository.findOne({
      where: { tokenId: positionId },
      relations: ['stakes'],
    });

    const incentive = await this.incentiveRepository.findOne({
      where: { incentiveId },
    });

    const stake = await this.stakeRepository.findOne({
      where: {
        position: { id: position.id },
        incentive: { id: incentive.id },
      },
    });

    if (!position || !incentive || !stake) {
      throw new Error('Position, incentive, or stake not found');
    }

    const currentTime = Math.floor(Date.now() / 1000);

    const result = this.rewardCalculator.computeRewardAmount({
      totalRewardUnclaimed: BigInt(incentive.totalRewardUnclaimed),
      totalSecondsClaimedX128: BigInt(incentive.totalSecondsClaimedX128.toString()),
      startTime: parseInt(incentive.startTime),
      endTime: parseInt(incentive.endTime),
      vestingPeriod: parseInt(incentive.vestingPeriod),
      liquidity: BigInt(stake.liquidity),
      secondsPerLiquidityInsideInitialX128: BigInt(
        stake.secondsPerLiquidityInsideInitialX128,
      ),
      secondsPerLiquidityInsideX128: BigInt(
        stake.secondsPerLiquidityInsideInitialX128,
      ), // This should be updated with current value
      secondsInsideInitial: stake.secondsInsideInitial,
      secondsInside: stake.secondsInsideInitial, // This should be updated with current value
      currentTime,
    });

    return {
      reward: result.reward.toString(),
      maxReward: result.maxReward.toString(),
    };
  }

  async getPendingRewards(userAddress: string) {
    const positions = await this.positionRepository.find({
      where: { ownerAddress: userAddress },
      relations: ['stakes', 'stakes.incentive'],
    });

    const rewards: Record<string, string> = {};

    for (const position of positions) {
      for (const stake of position.stakes) {
        const result = await this.calculateRewards(
          position.tokenId,
          stake.incentive.incentiveId,
        );
        const rewardToken = stake.incentive.rewardToken;

        const currentReward = BigInt(rewards[rewardToken] || '0');
        const newReward = currentReward + BigInt(result.reward);
        rewards[rewardToken] = newReward.toString();
      }
    }

    return rewards;
  }
}
