import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
} from 'typeorm';

@Entity('stock_portfolio')
export class StockPortfolio {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column()
	code: string;

	@Column('decimal', { precision: 12, scale: 2, name: 'buy_price' })
	buyPrice: number;

	@Column()
	quantity: number;

	@Column({ name: 'buy_date' })
	buyDate: string;

	@Column({ nullable: true })
	memo: string;

	@Column('decimal', {
		precision: 12,
		scale: 2,
		nullable: true,
		name: 'sell_price',
	})
	sellPrice: number;

	@Column({ nullable: true, name: 'sell_date' })
	sellDate: string;

	@Column({ name: 'is_active', default: true })
	isActive: boolean;

	@CreateDateColumn({ name: 'created_at' })
	createdAt: Date;
}
