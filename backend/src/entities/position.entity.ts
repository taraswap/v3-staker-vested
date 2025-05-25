import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn()
  id: number;

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
