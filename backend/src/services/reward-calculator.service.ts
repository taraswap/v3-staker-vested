import { Injectable } from '@nestjs/common';
import { BigNumber } from 'ethers';

@Injectable()
export class RewardCalculator {
  computeRewardAmount(params: {
    totalRewardUnclaimed: BigNumber;
    totalSecondsClaimedX128: BigNumber;
    startTime: number;
    endTime: number;
    vestingPeriod: number;
    liquidity: BigNumber;
    secondsPerLiquidityInsideInitialX128: BigNumber;
    secondsPerLiquidityInsideX128: BigNumber;
    secondsInsideInitial: number;
    secondsInside: number;
    currentTime: number;
  }) {
    const secondsInsideX128 = params.secondsPerLiquidityInsideX128
      .sub(params.secondsPerLiquidityInsideInitialX128)
      .mul(params.liquidity);

    const totalSecondsUnclaimedX128 = BigNumber.from(
      Math.max(params.endTime, params.currentTime),
    )
      .sub(params.startTime)
      .shl(128)
      .sub(params.totalSecondsClaimedX128);

    const maxReward = params.totalRewardUnclaimed
      .mul(secondsInsideX128)
      .div(totalSecondsUnclaimedX128);

    let reward: BigNumber;
    if (
      params.vestingPeriod <=
      params.secondsInside - params.secondsInsideInitial
    ) {
      reward = maxReward;
    } else {
      reward = maxReward
        .mul(params.secondsInside - params.secondsInsideInitial)
        .div(params.vestingPeriod);
    }

    return {
      reward,
      maxReward,
      secondsInsideX128,
    };
  }
}
