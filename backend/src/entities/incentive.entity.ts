import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('incentives')
export class Incentive {
  @PrimaryGeneratedColumn()
  id: number;

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
}
