import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CrawlerModule } from '../crawler/crawler.module';
import { LlmModule } from '../llm/llm.module';
import { StockWatchlist } from './stock.entity';
import { StockPortfolio } from './stock-portfolio.entity';
import { StockPrediction } from './stock-prediction.entity';
import { StockController } from './stock.controller';
import { StockCrawlerService } from './stock-crawler.service';
import { StockAnalysisService } from './stock-analysis.service';
import { StockWatchlistService } from './stock-watchlist.service';
import { StockPortfolioService } from './stock-portfolio.service';
import { StockPredictionService } from './stock-prediction.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([StockWatchlist, StockPortfolio, StockPrediction]),
		ConfigModule,
		CrawlerModule,
		LlmModule,
	],
	controllers: [StockController],
	providers: [
		StockCrawlerService,
		StockAnalysisService,
		StockWatchlistService,
		StockPortfolioService,
		StockPredictionService,
	],
	exports: [StockAnalysisService, StockWatchlistService, StockPortfolioService, StockPredictionService],
})
export class StockModule {}
