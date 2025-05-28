import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Stake } from './stake.entity';

@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany(() => Stake, (stake) => stake.position)
  stakes: Stake[];

  @Column('bigint', { name: 'token_id' })
  tokenId: string;

  @Column({ name: 'owner_address' })
  ownerAddress: string;

  @Column({ name: 'tick_lower' })
  tickLower: number;

  @Column({ name: 'tick_upper' })
  tickUpper: number;

  @Column('bigint')
  liquidity: string;

  @Column('bigint', { default: '0', name: 'last_reward_calculation_time' })
  lastRewardCalculationTime: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
