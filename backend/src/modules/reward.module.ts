import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardController } from '../controllers/reward.controller';
import { RewardService } from '../services/reward.service';
import { RewardCalculator } from '../services/reward-calculator.service';
import { Position } from '../entities/position.entity';
import { Incentive } from '../entities/incentive.entity';
import { Stake } from '../entities/stake.entity';
import { RewardClaim } from '../entities/reward-claim.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Position, Incentive, Stake, RewardClaim]),
  ],
  controllers: [RewardController],
  providers: [RewardService, RewardCalculator],
  exports: [RewardService],
})
export class RewardModule {}
