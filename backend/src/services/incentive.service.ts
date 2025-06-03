import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Incentive } from '../entities/incentive.entity';
import { RewardClaim } from '../entities/reward-claim.entity';
import { CreateIncentiveDto } from '../dto/create-incentive.dto';
import { ClaimRewardDto } from '../dto/claim-reward.dto';
import { CalculateRewardsDto } from '../dto/calculate-rewards.dto';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { SubgraphService } from './subgraph.service';

@Injectable()
export class IncentiveService {
  private readonly TSWAP_TOKEN_ADDRESS: string;
  private readonly REWARD_WALLET_PRIVATE_KEY: string;

  constructor(
    @InjectRepository(Incentive)
    private incentiveRepository: Repository<Incentive>,
    @InjectRepository(RewardClaim)
    private rewardClaimRepository: Repository<RewardClaim>,
    private configService: ConfigService,
    private subgraphService: SubgraphService,
    private dataSource: DataSource,
  ) {
    this.TSWAP_TOKEN_ADDRESS = this.configService.get<string>(
      'TSWAP_TOKEN_ADDRESS',
    );
    this.REWARD_WALLET_PRIVATE_KEY = this.configService.get<string>(
      'REWARD_WALLET_PRIVATE_KEY',
    );
  }

  async createIncentive(
    createIncentiveDto: CreateIncentiveDto,
  ): Promise<Incentive> {
    const incentive = new Incentive();
    incentive.rewardToken = createIncentiveDto.rewardToken;
    if (incentive.rewardToken.toLowerCase() !== this.TSWAP_TOKEN_ADDRESS.toLowerCase()) {
      throw new BadRequestException('Invalid reward token');
    }
    incentive.poolAddress = createIncentiveDto.poolAddress;
    incentive.startTime = createIncentiveDto.startTime.toString();
    incentive.endTime = createIncentiveDto.endTime.toString();
    incentive.vestingPeriod = createIncentiveDto.vestingPeriod.toString();
    incentive.totalRewardUnclaimed =
      createIncentiveDto.totalRewardUnclaimed.toString();
    incentive.totalRewardClaimed = '0';

    const incentiveId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'uint256', 'uint256'],
        [
          createIncentiveDto.poolAddress,
          createIncentiveDto.startTime,
          createIncentiveDto.endTime,
          createIncentiveDto.vestingPeriod,
        ],
      ),
    );
    incentive.incentiveId = incentiveId;
    return this.incentiveRepository.save(incentive);
  }

  async calculateRewards(
    calculateRewardsDto: CalculateRewardsDto,
  ): Promise<{
    reward: string;
    maxReward: string;
    feeData?: {
      totalAccruedFeesToken0: string;
      totalAccruedFeesToken1: string;
      totalCollectedFeesToken0: string;
      totalCollectedFeesToken1: string;
      feeMultiplier: string;
    };
  }> {
    const incentive = await this.incentiveRepository.findOne({
      where: { incentiveId: calculateRewardsDto.incentiveId },
    });

    if (!incentive) {
      throw new NotFoundException('Incentive not found');
    }

    const positionData = await this.subgraphService.getPositionData(
      calculateRewardsDto.tokenId.toString(),
    );

    if (!positionData) {
      throw new NotFoundException('Position not found in subgraph');
    }

    if (positionData.pool.id.toLowerCase() !== incentive.poolAddress.toLowerCase()) {
      throw new BadRequestException('Position is not in the incentive pool');
    }

    const lastClaim = await this.rewardClaimRepository.findOne({
      where: {
        tokenId: calculateRewardsDto.tokenId,
        incentiveId: calculateRewardsDto.incentiveId,
      },
      order: { claimedAt: 'DESC' },
    });

    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = parseInt(incentive.startTime);
    const endTime = parseInt(incentive.endTime);
    const vestingPeriod = parseInt(incentive.vestingPeriod);
    const positionCreatedAt = parseInt(positionData.transaction.timestamp);

    const rewardStartTime = lastClaim && lastClaim.claimedAt ?
      Math.floor(new Date(lastClaim.claimedAt).getTime() / 1000) :
      Math.max(positionCreatedAt, startTime);

    const rewardEndTime = Math.min(currentTime, endTime);

    // const positionWasInRange = await this.subgraphService.checkPositionInRangeDuringPeriod(
    //   calculateRewardsDto.tokenId.toString(),
    //   incentive.poolAddress.toLowerCase(),
    //   rewardStartTime,
    //   rewardEndTime
    // );

    // if (!positionWasInRange) {
    //   return {
    //     reward: '0',
    //     maxReward: '0',
    //   };
    // }

    // Get fee collection data for the position during the reward period
    const feeCollectionData = await this.subgraphService.getPositionFeeCollectionData(
      calculateRewardsDto.tokenId.toString(),
      rewardStartTime,
      rewardEndTime
    );
    console.log('feeCollectionData', feeCollectionData)

    // If no accrued fees data is available, estimate from swaps
    let totalFeesAccrued = BigInt(feeCollectionData.totalAccruedFeesToken0) +
      BigInt(feeCollectionData.totalAccruedFeesToken1);

    if (totalFeesAccrued === BigInt(0)) {
      console.log('No direct fee data');
      // const feeEstimate = await this.subgraphService.getPositionFeeEstimateFromSwaps(
      //   calculateRewardsDto.tokenId.toString(),
      //   incentive.poolAddress.toLowerCase(),
      //   rewardStartTime,
      //   rewardEndTime
      // );

      // totalFeesAccrued = BigInt(feeEstimate.estimatedFeesToken0) +
      //   BigInt(feeEstimate.estimatedFeesToken1);

      // console.log('Fee estimate from swaps:', {
      //   estimatedFeesToken0: feeEstimate.estimatedFeesToken0,
      //   estimatedFeesToken1: feeEstimate.estimatedFeesToken1,
      //   swapCount: feeEstimate.swapCount,
      //   totalEstimated: totalFeesAccrued.toString()
      // });
    }

    const timeInRange = Math.max(0, rewardEndTime - rewardStartTime);
    const totalIncentiveReward = BigInt(incentive.totalRewardUnclaimed);

    const positionLiquidity = BigInt(positionData.liquidity || '0');

    if (positionLiquidity === BigInt(0)) {
      return {
        reward: '0',
        maxReward: '0',
      };
    }

    const totalPoolLiquidity = BigInt(positionData.pool.liquidity || '1');

    // Base position reward proportional to liquidity
    const basePositionMaxReward = (totalIncentiveReward * positionLiquidity) / totalPoolLiquidity;

    // Calculate fee collection multiplier
    // This rewards positions that generate more trading fees
    // Fee multiplier ranges from 1.0 (no fees) to 2.0 (high fees)
    // The multiplier is based on accrued/estimated fees relative to position liquidity
    let feeMultiplier = BigInt(1000); // Base multiplier * 1000 for precision

    if (totalFeesAccrued > BigInt(0) && positionLiquidity > BigInt(0)) {
      // Calculate fees as percentage of liquidity (in basis points)
      const feeRatio = (totalFeesAccrued * BigInt(10000)) / positionLiquidity;

      // Multiplier increases with fee ratio, capped at 2.0x
      // Formula: 1.0 + min(feeRatio / 1000, 1.0)
      const bonusMultiplier = feeRatio > BigInt(1000) ? BigInt(1000) : feeRatio;
      feeMultiplier = BigInt(1000) + bonusMultiplier; // 1000-2000 range
    }

    console.log('Fee multiplier calculation:', {
      totalFeesAccrued: totalFeesAccrued.toString(),
      positionLiquidity: positionLiquidity.toString(),
      feeMultiplier: feeMultiplier.toString()
    });

    // Apply fee multiplier to max reward
    const positionMaxReward = (basePositionMaxReward * feeMultiplier) / BigInt(1000);

    let earnedReward: bigint;
    if (timeInRange >= vestingPeriod) {
      earnedReward = positionMaxReward;
    } else if (timeInRange > 0) {
      earnedReward = (positionMaxReward * BigInt(timeInRange)) / BigInt(vestingPeriod);
    } else {
      earnedReward = BigInt(0);
    }

    if (lastClaim) {
      const previouslyClaimed = BigInt(lastClaim.amount || '0');
      earnedReward = earnedReward > previouslyClaimed ? earnedReward - previouslyClaimed : BigInt(0);
    }

    return {
      reward: earnedReward.toString(),
      maxReward: positionMaxReward.toString(),
      feeData: {
        totalAccruedFeesToken0: feeCollectionData.totalAccruedFeesToken0,
        totalAccruedFeesToken1: feeCollectionData.totalAccruedFeesToken1,
        totalCollectedFeesToken0: feeCollectionData.totalCollectedFeesToken0,
        totalCollectedFeesToken1: feeCollectionData.totalCollectedFeesToken1,
        feeMultiplier: (feeMultiplier / BigInt(10)).toString(), // Convert back to decimal (divide by 10 for 1 decimal place)
      },
    };
  }

  async claimReward(claimRewardDto: ClaimRewardDto): Promise<RewardClaim> {
    const { reward } = await this.calculateRewards({
      incentiveId: claimRewardDto.incentiveId,
      tokenId: claimRewardDto.tokenId,
    });

    if (BigInt(reward) <= BigInt(0)) {
      throw new BadRequestException('No rewards to claim');
    }

    const amount = ethers.formatUnits(reward, 18);
    console.log('Sending reward:', amount, 'TSWAP to', claimRewardDto.userAddress);

    const provider = new ethers.JsonRpcProvider(
      this.configService.get<string>('RPC_URL'),
    );
    const wallet = new ethers.Wallet(this.REWARD_WALLET_PRIVATE_KEY, provider);

    const tokenAbi = [
      "function transfer(address to, uint256 amount) returns (bool)",
    ];
    const tokenContract = new ethers.Contract(
      this.TSWAP_TOKEN_ADDRESS,
      tokenAbi,
      wallet,
    );

    let receipt: any;
    try {
      const tx = await tokenContract.transfer(
        claimRewardDto.userAddress,
        reward,
      );
      receipt = await tx.wait();
    } catch (error) {
      throw new BadRequestException(`Failed to send rewards: ${error.message}`);
    }

    if (!receipt || receipt.status !== 1) {
      throw new BadRequestException('Transaction failed to send rewards');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const rewardClaim = new RewardClaim();
      rewardClaim.userAddress = claimRewardDto.userAddress;
      rewardClaim.amount = reward;
      rewardClaim.incentiveId = claimRewardDto.incentiveId;
      rewardClaim.tokenId = claimRewardDto.tokenId;
      rewardClaim.txHash = receipt.hash;

      const savedRewardClaim = await queryRunner.manager.save(RewardClaim, rewardClaim);
      const incentive = await queryRunner.manager.findOne(Incentive, {
        where: { incentiveId: claimRewardDto.incentiveId },
      });

      if (!incentive) {
        throw new NotFoundException('Incentive not found');
      }

      incentive.totalRewardUnclaimed = (BigInt(incentive.totalRewardUnclaimed) - BigInt(reward)).toString();
      incentive.totalRewardClaimed = (BigInt(incentive.totalRewardClaimed) + BigInt(reward)).toString();
      await queryRunner.manager.update(Incentive, incentive.id, incentive);

      await queryRunner.commitTransaction();
      return savedRewardClaim;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(`Failed to save reward claim: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async getIncentive(incentiveId: string): Promise<Incentive> {
    const incentive = await this.incentiveRepository.findOne({
      where: { incentiveId },
      relations: ['stakes'],
    });

    if (!incentive) {
      throw new NotFoundException('Incentive not found');
    }

    return incentive;
  }
}
