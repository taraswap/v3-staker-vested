import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('reward_claims')
export class RewardClaim {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userAddress: string;

  @Column()
  rewardToken: string;

  @Column('bigint')
  amount: string;

  @CreateDateColumn()
  claimedAt: Date;
}
