import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncentiveController } from '../controllers/incentive.controller';
import { IncentiveService } from '../services/incentive.service';
import { Incentive } from '../entities/incentive.entity';
import { Position } from '../entities/position.entity';
import { Stake } from '../entities/stake.entity';
import { RewardClaim } from '../entities/reward-claim.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Incentive, Position, Stake, RewardClaim]),
  ],
  controllers: [IncentiveController],
  providers: [IncentiveService],
  exports: [IncentiveService],
})
export class IncentiveModule {}
