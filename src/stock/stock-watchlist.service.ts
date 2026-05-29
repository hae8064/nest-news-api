import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { StockWatchlist } from './stock.entity';

interface StockConfig {
	name: string;
	code: string;
}

@Injectable()
export class StockWatchlistService implements OnModuleInit {
	private readonly logger = new Logger(StockWatchlistService.name);

	constructor(
		@InjectRepository(StockWatchlist)
		private readonly repository: Repository<StockWatchlist>,
		private readonly configService: ConfigService,
	) {}

	async onModuleInit() {
		const count = await this.repository.count();
		if (count > 0) return;

		const watchlistJson =
			this.configService.get<string>('STOCK_WATCHLIST') || '';
		if (!watchlistJson) return;

		try {
			const watchlist: StockConfig[] = JSON.parse(watchlistJson);
			for (const stock of watchlist) {
				const exists = await this.repository.findOne({
					where: { code: stock.code },
				});
				if (!exists) {
					await this.repository.save(
						this.repository.create({
							name: stock.name,
							code: stock.code,
						}),
					);
				}
			}
			this.logger.log(`종목 ${watchlist.length}개 초기화 완료`);
		} catch (error) {
			this.logger.error('종목 초기화 실패', error);
		}
	}

	async getActiveStocks(): Promise<StockWatchlist[]> {
		return this.repository.find({ where: { isActive: true } });
	}

	async getAllStocks(): Promise<StockWatchlist[]> {
		return this.repository.find();
	}

	async addStock(name: string, code: string): Promise<StockWatchlist> {
		const existing = await this.repository.findOne({ where: { code } });
		if (existing) {
			existing.isActive = true;
			existing.name = name;
			return this.repository.save(existing);
		}
		return this.repository.save(this.repository.create({ name, code }));
	}

	async removeStock(code: string): Promise<void> {
		const stock = await this.repository.findOne({ where: { code } });
		if (stock) {
			stock.isActive = false;
			await this.repository.save(stock);
		}
	}
}
