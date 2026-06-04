import {
	Controller,
	Get,
	Post,
	Delete,
	Patch,
	Body,
	Param,
	ValidationPipe,
} from '@nestjs/common';
import { StockAnalysisService } from './stock-analysis.service';
import { StockWatchlistService } from './stock-watchlist.service';
import { StockPortfolioService } from './stock-portfolio.service';
import { StockWatchlistRequestDto } from './dto/stock-watchlist-request.dto';
import {
	AddPortfolioDto,
	SellPortfolioDto,
} from './dto/stock-portfolio-request.dto';

@Controller('stock/v1')
export class StockController {
	constructor(
		private readonly stockAnalysisService: StockAnalysisService,
		private readonly stockWatchlistService: StockWatchlistService,
		private readonly stockPortfolioService: StockPortfolioService,
	) {}

	@Get('briefing')
	async getStockBriefing() {
		return this.stockAnalysisService.generateDailyBriefing();
	}

	@Get('watchlist')
	async getWatchlist() {
		return this.stockWatchlistService.getAllStocks();
	}

	@Post('watchlist')
	async addStock(
		@Body(new ValidationPipe()) request: StockWatchlistRequestDto,
	) {
		return this.stockWatchlistService.addStock(request.name, request.code);
	}

	@Delete('watchlist/:code')
	async removeStock(@Param('code') code: string) {
		await this.stockWatchlistService.removeStock(code);
		return { message: `종목 비활성화 완료: ${code}` };
	}

	@Get('portfolio')
	async getPortfolio() {
		return this.stockPortfolioService.getAllPositions();
	}

	@Post('portfolio')
	async addPosition(
		@Body(new ValidationPipe()) request: AddPortfolioDto,
	) {
		return this.stockPortfolioService.addPosition(request);
	}

	@Patch('portfolio/:id/sell')
	async sellPosition(
		@Param('id') id: string,
		@Body(new ValidationPipe()) request: SellPortfolioDto,
	) {
		await this.stockPortfolioService.sellPosition(
			parseInt(id, 10),
			request.sellPrice,
			request.sellDate,
		);
		return { message: '매도 처리 완료' };
	}
}
