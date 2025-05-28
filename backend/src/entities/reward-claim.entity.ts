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

  @Column({ name: 'user_address' })
  userAddress: string;

  @Column('bigint')
  amount: string;

  @Column({ name: 'incentive_id' })
  incentiveId: string;

  @Column('bigint', { name: 'token_id' })
  tokenId: number;

  @CreateDateColumn({ type: 'timestamp', name: 'claimed_at' })
  claimedAt: Date;
}
