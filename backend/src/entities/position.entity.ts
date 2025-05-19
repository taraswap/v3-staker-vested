import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Stake } from './stake.entity';

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

  @OneToMany(() => Stake, (stake) => stake.position)
  stakes: Stake[];

  @CreateDateColumn()
  createdAt: Date;
}
