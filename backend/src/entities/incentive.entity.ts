import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

@Entity('incentives')
export class Incentive {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'incentive_id' })
  @Index({ unique: true })
  incentiveId: string;

  @Column({ name: 'pool_address' })
  poolAddress: string;

  @Column({ name: 'refundee_address' })
  refundeeAddress: string;

  @Column('bigint', { name: 'start_time' })
  startTime: string;

  @Column('bigint', { name: 'end_time' })
  endTime: string;

  @Column('bigint', { name: 'vesting_period' })
  vestingPeriod: string;

  @Column('decimal', { precision: 78, scale: 0, name: 'total_reward_unclaimed' })
  totalRewardUnclaimed: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column('varchar', { length: 42, name: 'reward_token' })
  rewardToken: string;

  @Column('decimal', { precision: 78, scale: 0, name: 'total_reward_claimed' })
  totalRewardClaimed: string;
}
