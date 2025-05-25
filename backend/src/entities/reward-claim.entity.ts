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

  @Column('bigint')
  amount: string;

  @Column()
  incentiveId: string;

  @Column('bigint')
  tokenId: string;

  @CreateDateColumn()
  claimedAt: Date;
}
