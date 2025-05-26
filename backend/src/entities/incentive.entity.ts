import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Stake } from './stake.entity';

@Entity('incentives')
export class Incentive {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany(() => Stake, (stake) => stake.incentive)
  stakes: Stake[];

  @Column()
  incentiveId: string;

  @Column()
  poolAddress: string;

  @Column('bigint')
  startTime: string;

  @Column('bigint')
  endTime: string;

  @Column('bigint')
  vestingPeriod: string;

  @Column('bigint')
  totalRewardUnclaimed: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column('varchar', { length: 42 })
  rewardToken: string;

  @Column('bigint')
  totalSecondsClaimedX128: BigInt;

  @Column('bigint')
  totalRewardClaimed: BigInt;
}
