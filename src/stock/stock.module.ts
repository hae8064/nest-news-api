import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CrawlerModule } from '../crawler/crawler.module';
import { LlmModule } from '../llm/llm.module';
import { StockWatchlist } from './stock.entity';
import { StockController } from './stock.controller';
import { StockCrawlerService } from './stock-crawler.service';
import { StockAnalysisService } from './stock-analysis.service';
import { StockWatchlistService } from './stock-watchlist.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([StockWatchlist]),
		ConfigModule,
		CrawlerModule,
		LlmModule,
	],
	controllers: [StockController],
	providers: [StockCrawlerService, StockAnalysisService, StockWatchlistService],
	exports: [StockAnalysisService, StockWatchlistService],
})
export class StockModule {}
