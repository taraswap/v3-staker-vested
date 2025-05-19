import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Stake } from './stake.entity';

@Entity('incentives')
export class Incentive {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  incentiveId: string;

  @Column()
  rewardToken: string;

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

  @Column('bigint')
  totalSecondsClaimedX128: string;

  @OneToMany(() => Stake, (stake) => stake.incentive)
  stakes: Stake[];

  @CreateDateColumn()
  createdAt: Date;
}
