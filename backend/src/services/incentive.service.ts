import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    incentive.poolAddress = createIncentiveDto.poolAddress;
    incentive.startTime = createIncentiveDto.startTime.toString();
    incentive.endTime = createIncentiveDto.endTime.toString();
    incentive.vestingPeriod = createIncentiveDto.vestingPeriod.toString();
    incentive.totalRewardUnclaimed =
      createIncentiveDto.totalRewardUnclaimed.toString();
    incentive.totalSecondsClaimedX128 = BigInt(0);
    incentive.totalRewardClaimed = BigInt(0);

    // Generate a unique incentive ID using keccak256 hash
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

  async joinIncentive(joinIncentiveDto: JoinIncentiveDto): Promise<Stake> {
    const incentive = await this.incentiveRepository.findOne({
      where: { incentiveId: joinIncentiveDto.incentiveId },
    });

    if (!incentive) {
      throw new Error('Incentive not found');
    }

    const position = await this.positionRepository.findOne({
      where: { tokenId: joinIncentiveDto.tokenId.toString() },
    });

    if (!position) {
      throw new Error('Position not found');
    }

    if (position.ownerAddress !== joinIncentiveDto.ownerAddress) {
      throw new Error('Not the owner of the position');
    }

    const stake = new Stake();
    stake.incentive = incentive;
    stake.position = position;
    stake.secondsPerLiquidityInsideInitialX128 = '0'; // This should be fetched from the pool
    stake.secondsInsideInitial = 0; // This should be fetched from the pool
    stake.liquidity = position.liquidity;

    return this.stakeRepository.save(stake);
  }

  async calculateRewards(
    calculateRewardsDto: CalculateRewardsDto,
  ): Promise<{ reward: string; maxReward: string }> {
    const incentive = await this.incentiveRepository.findOne({
      where: { incentiveId: calculateRewardsDto.incentiveId },
    });

    if (!incentive) {
      throw new Error('Incentive not found');
    }

    const position = await this.positionRepository.findOne({
      where: { tokenId: calculateRewardsDto.tokenId.toString() },
    });

    if (!position) {
      throw new Error('Position not found');
    }

    // Get the current time and calculate time in range
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = parseInt(incentive.startTime);
    const endTime = parseInt(incentive.endTime);
    const vestingPeriod = parseInt(incentive.vestingPeriod);

    // Calculate time in range since last calculation
    const lastCalculationTime =
      parseInt(position.lastRewardCalculationTime) || startTime;
    const timeInRange = Math.min(currentTime, endTime) - lastCalculationTime;

    // Calculate rewards based on time in range and vesting period
    const maxReward = incentive.totalRewardUnclaimed;
    const reward =
      timeInRange >= vestingPeriod
        ? maxReward
        : (
            (BigInt(maxReward) * BigInt(timeInRange)) /
            BigInt(vestingPeriod)
          ).toString();

    // Update last calculation time
    position.lastRewardCalculationTime = currentTime.toString();
    await this.positionRepository.save(position);

    return { reward, maxReward };
  }

  async claimReward(claimRewardDto: ClaimRewardDto): Promise<RewardClaim> {
    // Calculate current rewards
    const { reward } = await this.calculateRewards({
      incentiveId: claimRewardDto.incentiveId,
      tokenId: claimRewardDto.tokenId,
    });

    if (BigInt(reward) <= BigInt(0)) {
      throw new Error('No rewards to claim');
    }

    // Create reward claim record
    const rewardClaim = new RewardClaim();
    rewardClaim.userAddress = claimRewardDto.userAddress;
    rewardClaim.amount = reward;
    rewardClaim.incentiveId = claimRewardDto.incentiveId;
    rewardClaim.tokenId = claimRewardDto.tokenId.toString();

    // Send TSWAP tokens using the reward wallet
    const provider = new ethers.JsonRpcProvider(
      this.configService.get<string>('RPC_URL'),
    );
    const wallet = new ethers.Wallet(this.REWARD_WALLET_PRIVATE_KEY, provider);

    // TSWAP token contract ABI (minimal for transfer)
    const tokenAbi = [
      'function transfer(address to, uint256 amount) returns (bool)',
    ];
    const tokenContract = new ethers.Contract(
      this.TSWAP_TOKEN_ADDRESS,
      tokenAbi,
      wallet,
    );

    try {
      const tx = await tokenContract.transfer(
        claimRewardDto.userAddress,
        reward,
      );
      await tx.wait(); // Wait for transaction confirmation
    } catch (error) {
      throw new Error(`Failed to send rewards: ${error.message}`);
    }

    return this.rewardClaimRepository.save(rewardClaim);
  }

  async getIncentive(incentiveId: string): Promise<Incentive> {
    const incentive = await this.incentiveRepository.findOne({
      where: { incentiveId },
      relations: ['stakes'],
    });

    if (!incentive) {
      throw new Error('Incentive not found');
    }

    return incentive;
  }
}
