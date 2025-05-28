import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Stake } from './stake.entity';

@Entity('incentives')
export class Incentive {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany(() => Stake, (stake) => stake.incentive)
  stakes: Stake[];

  @Column({ name: 'incentive_id' })
  @Index({ unique: true })
  incentiveId: string;

  @Column({ name: 'pool_address' })
  poolAddress: string;

  @Column('bigint', { name: 'start_time' })
  startTime: string;

  @Column('bigint', { name: 'end_time' })
  endTime: string;

  @Column('bigint', { name: 'vesting_period' })
  vestingPeriod: string;

  @Column('bigint', { name: 'total_reward_unclaimed' })
  totalRewardUnclaimed: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column('varchar', { length: 42, name: 'reward_token' })
  rewardToken: string;

  @Column('bigint', { name: 'total_seconds_claimed_x128' })
  totalSecondsClaimedX128: string;

  @Column('bigint', { name: 'total_reward_claimed' })
  totalRewardClaimed: string;
}
