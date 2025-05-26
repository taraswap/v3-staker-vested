import { Injectable } from '@nestjs/common';

@Injectable()
export class RewardCalculator {
  computeRewardAmount(params: {
    totalRewardUnclaimed: bigint;
    totalSecondsClaimedX128: bigint;
    startTime: number;
    endTime: number;
    vestingPeriod: number;
    liquidity: bigint;
    secondsPerLiquidityInsideInitialX128: bigint;
    secondsPerLiquidityInsideX128: bigint;
    secondsInsideInitial: number;
    secondsInside: number;
    currentTime: number;
  }) {
    const secondsInsideX128 = (params.secondsPerLiquidityInsideX128 - params.secondsPerLiquidityInsideInitialX128) * params.liquidity;

    const totalSecondsUnclaimedX128 = BigInt(Math.max(params.endTime, params.currentTime))
      - BigInt(params.startTime)
      << BigInt(128)
      - params.totalSecondsClaimedX128;

    const maxReward = (params.totalRewardUnclaimed * secondsInsideX128) / totalSecondsUnclaimedX128;

    let reward: bigint;
    if (params.vestingPeriod <= params.secondsInside - params.secondsInsideInitial) {
      reward = maxReward;
    } else {
      reward = (maxReward * BigInt(params.secondsInside - params.secondsInsideInitial)) / BigInt(params.vestingPeriod);
    }

    return {
      reward,
      maxReward,
      secondsInsideX128,
    };
  }
}
