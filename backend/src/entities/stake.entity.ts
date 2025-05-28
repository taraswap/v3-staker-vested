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

  @Column('bigint', { name: 'seconds_per_liquidity_inside_initial_x128' })
  secondsPerLiquidityInsideInitialX128: string;

  @Column({ name: 'seconds_inside_initial' })
  secondsInsideInitial: number;

  @Column('bigint')
  liquidity: string;

  @CreateDateColumn({ name: 'staked_at' })
  stakedAt: Date;
}
