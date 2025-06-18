import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncentiveController } from '../controllers/incentive.controller';
import { IncentiveService } from '../services/incentive.service';
import { SubgraphService } from '../services/subgraph.service';
import { Incentive } from '../entities/incentive.entity';
import { RewardClaim } from '../entities/reward-claim.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Incentive, RewardClaim]),
  ],
  controllers: [IncentiveController],
  providers: [IncentiveService, SubgraphService],
  exports: [IncentiveService],
})
export class IncentiveModule { }
