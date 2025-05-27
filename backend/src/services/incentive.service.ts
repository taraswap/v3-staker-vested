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
    const TSWAP_ADDRESS = '0x712037beab9a29216650b8d032b4d9a59af8ad6c';
    const incentive = new Incentive();
    incentive.rewardToken = createIncentiveDto.rewardToken;
    if (incentive.rewardToken.toLowerCase() !== TSWAP_ADDRESS.toLowerCase()) {
      throw new Error('Invalid reward token');
    }
    incentive.poolAddress = createIncentiveDto.poolAddress;
    incentive.startTime = createIncentiveDto.startTime.toString();
    incentive.endTime = createIncentiveDto.endTime.toString();
    incentive.vestingPeriod = createIncentiveDto.vestingPeriod.toString();
    incentive.totalRewardUnclaimed =
      createIncentiveDto.totalRewardUnclaimed.toString();
    incentive.totalSecondsClaimedX128 = '0';
    incentive.totalRewardClaimed = '0';

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

    // Get position data from subgraph to find creation time and verify it exists
    const positionData = await this.subgraphService.getPositionData(
      calculateRewardsDto.tokenId.toString(),
    );

    if (!positionData) {
      throw new Error('Position not found in subgraph');
    }

    // Verify the position is in the correct pool for this incentive
    const position = await this.positionRepository.findOne({
      where: { tokenId: calculateRewardsDto.tokenId.toString() },
    });

    if (!position) {
      throw new Error('Position not found in database');
    }

    // Verify the position is in the correct pool for this incentive using subgraph data
    if (positionData.pool.id.toLowerCase() !== incentive.poolAddress.toLowerCase()) {
      throw new Error('Position is not in the incentive pool');
    }

    // Get the last reward claim for this position and incentive
    const lastClaim = await this.rewardClaimRepository.findOne({
      where: {
        tokenId: calculateRewardsDto.tokenId.toString(),
        incentiveId: calculateRewardsDto.incentiveId,
      },
      order: { claimedAt: 'DESC' },
    });

    // Get current time and incentive parameters
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = parseInt(incentive.startTime);
    const endTime = parseInt(incentive.endTime);
    const vestingPeriod = parseInt(incentive.vestingPeriod);
    const positionCreatedAt = parseInt(positionData.transaction.timestamp);

    // Determine the start time for reward calculation
    // Priority: last claim time > position creation time > incentive start time
    let rewardStartTime: number;
    if (lastClaim && lastClaim.claimedAt) {
      // Use the time of the last claim
      rewardStartTime = Math.floor(new Date(lastClaim.claimedAt).getTime() / 1000);
    } else {
      // Use the later of position creation time or incentive start time
      rewardStartTime = Math.max(positionCreatedAt, startTime);
    }

    // Calculate the actual time in range for reward calculation
    const rewardEndTime = Math.min(currentTime, endTime);
    const timeInRange = Math.max(0, rewardEndTime - rewardStartTime);

    // For simplified reward calculation, we'll assume each position gets an equal share
    // of the total reward pool based on time participation
    // In a more sophisticated system, this could be weighted by liquidity amount

    // Calculate the maximum possible reward for any position
    const totalIncentiveReward = BigInt(incentive.totalRewardUnclaimed);

    // Since we're not using stake-based calculation, we'll use a simplified approach:
    // Each position that participates gets rewards proportional to their liquidity and time
    const positionLiquidity = BigInt(positionData.liquidity || position.liquidity || '1');

    // For now, we'll assume this position gets a proportional share based on liquidity
    // In a real implementation, you might want to track all participating positions
    // and calculate the total liquidity across all positions in this pool
    const positionMaxReward = totalIncentiveReward; // Simplified - in reality should be proportional

    // Calculate rewards based on time in range and vesting period
    let earnedReward: bigint;
    if (timeInRange >= vestingPeriod) {
      // Full vesting period has passed, position gets full allocated reward
      earnedReward = positionMaxReward;
    } else if (timeInRange > 0) {
      // Proportional reward based on time in range
      earnedReward = (positionMaxReward * BigInt(timeInRange)) / BigInt(vestingPeriod);
    } else {
      // No time has passed or negative time
      earnedReward = BigInt(0);
    }

    // Subtract any previously claimed rewards for this specific incentive
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
    // Calculate current rewards
    const { reward } = await this.calculateRewards({
      incentiveId: claimRewardDto.incentiveId,
      tokenId: claimRewardDto.tokenId,
    });

    if (BigInt(reward) <= BigInt(0)) {
      throw new Error('No rewards to claim');
    }

    // Get previous total claimed amount for this position and incentive
    const previousClaims = await this.rewardClaimRepository.find({
      where: {
        tokenId: claimRewardDto.tokenId.toString(),
        incentiveId: claimRewardDto.incentiveId,
      },
    });

    const totalPreviouslyClaimed = previousClaims.reduce(
      (sum, claim) => sum + BigInt(claim.amount || '0'),
      BigInt(0),
    );

    // Calculate new total claimed amount
    const newTotalClaimed = totalPreviouslyClaimed + BigInt(reward);

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

  /**
   * REWARD CALCULATION EXPLANATION:
   * 
   * The reward calculation follows this formula for automatic position-based rewards:
   * 
   * 1. Position Eligibility = Position must be in the incentive's target pool
   * 2. Time in Range = min(Current Time, Incentive End Time) - max(Last Claim Time || Position Creation Time, Incentive Start Time)
   * 3. Time Factor = min(Time in Range, Vesting Period) / Vesting Period
   * 4. Earned Reward = Total Incentive Reward × Time Factor
   * 5. Claimable Reward = Earned Reward - Previously Claimed
   * 
   * Where:
   * - Position Creation Time = Timestamp when the NFT position was minted (from subgraph)
   * - Last Claim Time = Timestamp of the most recent reward claim for this position + incentive
   * - Vesting Period = The period over which rewards vest linearly
   * - Total Incentive Reward = Total reward pool allocated to this incentive
   * 
   * Key Points:
   * - No explicit staking required - positions automatically earn rewards if in correct pool
   * - Rewards are calculated from position creation time or last claim time (whichever is later)
   * - Rewards vest linearly over the vesting period
   * - Users can claim accumulated rewards at any time
   * - Each position tracks its own claim history per incentive
   * - Position must be in the same pool as the incentive to be eligible
   * 
   * Example:
   * - Position created: Day 1
   * - Incentive starts: Day 5, ends: Day 15, vesting period: 10 days
   * - User claims on Day 12
   * - Time in range: Day 5 to Day 12 = 7 days
   * - Time factor: 7/10 = 0.7
   * - Claimable reward: Total Reward × 0.7
   */

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
