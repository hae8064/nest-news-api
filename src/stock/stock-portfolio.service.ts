import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockPortfolio } from './stock-portfolio.entity';

@Injectable()
export class StockPortfolioService {
	private readonly logger = new Logger(StockPortfolioService.name);

	constructor(
		@InjectRepository(StockPortfolio)
		private readonly repo: Repository<StockPortfolio>,
	) {}

	async addPosition(data: {
		name: string;
		code: string;
		buyPrice: number;
		quantity: number;
		buyDate: string;
		memo?: string;
	}): Promise<StockPortfolio> {
		const position = this.repo.create(data);
		return this.repo.save(position);
	}

	async getActivePositions(): Promise<StockPortfolio[]> {
		return this.repo.find({ where: { isActive: true } });
	}

	async getPositionsByCode(code: string): Promise<StockPortfolio[]> {
		return this.repo.find({ where: { code, isActive: true } });
	}

	async sellPosition(
		id: number,
		sellPrice: number,
		sellDate: string,
	): Promise<void> {
		await this.repo.update(id, { sellPrice, sellDate, isActive: false });
	}

	async getAllPositions(): Promise<StockPortfolio[]> {
		return this.repo.find({ order: { createdAt: 'DESC' } });
	}

	buildPortfolioSummary(
		positions: StockPortfolio[],
		currentPrice: number,
	): string {
		if (positions.length === 0) return '';

		let totalQty = 0;
		let totalCost = 0;

		for (const p of positions) {
			totalQty += p.quantity;
			totalCost += p.buyPrice * p.quantity;
		}

		const avgPrice = Math.round(totalCost / totalQty);
		const totalValue = currentPrice * totalQty;
		const pnl = totalValue - totalCost;
		const pnlPercent = ((pnl / totalCost) * 100).toFixed(2);
		const sign = pnl >= 0 ? '+' : '';

		return [
			`보유 현황:`,
			`- ${totalQty}주 보유, 평단가 ${avgPrice.toLocaleString('ko-KR')}원`,
			`- 평가손익: ${sign}${Math.round(pnl / totalQty).toLocaleString('ko-KR')}원/주 (${sign}${pnlPercent}%)`,
			`- 총 평가금액: ${totalValue.toLocaleString('ko-KR')}원 (수익 ${sign}${pnl.toLocaleString('ko-KR')}원)`,
		].join('\n');
	}
}
