import {
	Controller,
	Get,
	Post,
	Delete,
	Body,
	Param,
	ValidationPipe,
} from '@nestjs/common';
import { StockAnalysisService } from './stock-analysis.service';
import { StockWatchlistService } from './stock-watchlist.service';
import { StockWatchlistRequestDto } from './dto/stock-watchlist-request.dto';

@Controller('stock/v1')
export class StockController {
	constructor(
		private readonly stockAnalysisService: StockAnalysisService,
		private readonly stockWatchlistService: StockWatchlistService,
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
}
