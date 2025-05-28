import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Incentive } from '../entities/incentive.entity';
import { Position } from '../entities/position.entity';
import { Stake } from '../entities/stake.entity';
import { RewardClaim } from '../entities/reward-claim.entity';
import { CreateIncentiveDto } from '../dto/create-incentive.dto';
import { JoinIncentiveDto } from '../dto/join-incentive.dto';
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
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Stake)
    private stakeRepository: Repository<Stake>,
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
    incentive.totalSecondsClaimedX128 = '0';
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
  ): Promise<{ reward: string; maxReward: string }> {
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

    const positionMaxReward = (totalIncentiveReward * positionLiquidity) / totalPoolLiquidity;

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
