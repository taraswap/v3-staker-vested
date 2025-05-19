import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Position } from './position.entity';
import { Incentive } from './incentive.entity';

@Entity('stakes')
export class Stake {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Position, (position) => position.stakes)
  position: Position;

  @ManyToOne(() => Incentive, (incentive) => incentive.stakes)
  incentive: Incentive;

  @Column('bigint')
  secondsPerLiquidityInsideInitialX128: string;

  @Column()
  secondsInsideInitial: number;

  @Column('bigint')
  liquidity: string;

  @CreateDateColumn()
  stakedAt: Date;
}
