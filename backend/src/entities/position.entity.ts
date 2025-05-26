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

  @Column('bigint')
  tokenId: string;

  @Column()
  ownerAddress: string;

  @Column()
  tickLower: number;

  @Column()
  tickUpper: number;

  @Column('bigint')
  liquidity: string;

  @Column('bigint', { default: '0' })
  lastRewardCalculationTime: string;

  @CreateDateColumn()
  createdAt: Date;
}
