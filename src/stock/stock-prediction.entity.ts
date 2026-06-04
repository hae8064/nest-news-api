import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('stock_prediction')
export class StockPrediction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  date: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column()
  judgment: string;

  @Column({ default: 3 })
  confidence: number;

  @Column({ name: 'signal_short', default: '' })
  signalShort: string;

  @Column({ name: 'signal_mid', default: '' })
  signalMid: string;

  @Column('decimal', { precision: 12, scale: 2, name: 'target_price', default: 0 })
  targetPrice: number;

  @Column('decimal', { precision: 12, scale: 2, name: 'stop_loss', default: 0 })
  stopLoss: number;

  @Column('decimal', { precision: 12, scale: 2, name: 'price_at_analysis', default: 0 })
  priceAtAnalysis: number;

  @Column('decimal', { precision: 12, scale: 2, name: 'price_after_1w', nullable: true })
  priceAfter1w: number;

  @Column('decimal', { precision: 12, scale: 2, name: 'price_after_1m', nullable: true })
  priceAfter1m: number;

  @Column({ name: 'is_direction_correct_1w', nullable: true })
  isDirectionCorrect1w: boolean;

  @Column({ name: 'is_target_hit_1w', nullable: true })
  isTargetHit1w: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
