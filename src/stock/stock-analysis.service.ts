import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { StockCrawlerService } from './stock-crawler.service';
import { StockWatchlistService } from './stock-watchlist.service';
import { StockAnalysisDto } from './dto/stock-analysis.dto';
import { StockBriefingDto } from './dto/stock-briefing.dto';
import { StockWatchlist } from './stock.entity';

@Injectable()
export class StockAnalysisService {
	private readonly logger = new Logger(StockAnalysisService.name);

	constructor(
		private readonly stockCrawlerService: StockCrawlerService,
		private readonly llmService: LlmService,
		private readonly stockWatchlistService: StockWatchlistService,
	) {}

	async generateDailyBriefing(): Promise<StockBriefingDto> {
		this.logger.log('종목 브리핑 생성 시작');

		const watchlist = await this.stockWatchlistService.getActiveStocks();
		if (watchlist.length === 0) {
			this.logger.warn('감시 종목이 없습니다.');
			return {
				analyses: [],
				marketSentiment: '감시 종목 없음',
				generatedAt: this.now(),
			};
		}

		const analyses = await Promise.all(
			watchlist.map((stock) => this.analyzeStock(stock)),
		);

		const summaries = analyses.map(
			(a) => `[${a.stockName}(${a.stockCode})] ${a.analysisText}`,
		);

		let marketSentiment: string;
		try {
			marketSentiment =
				await this.llmService.generateMarketSentiment(summaries);
		} catch (error) {
			this.logger.error('시장 종합 평가 생성 실패', error);
			marketSentiment = '시장 종합 평가 생성 실패';
		}

		this.logger.log('종목 브리핑 생성 완료');

		return {
			analyses,
			marketSentiment,
			generatedAt: this.now(),
		};
	}

	private async analyzeStock(stock: StockWatchlist): Promise<StockAnalysisDto> {
		this.logger.log(`종목 분석 시작: ${stock.name} (${stock.code})`);

		const news = await this.stockCrawlerService.fetchStockNews(
			stock.name,
			stock.code,
		);

		let analysisText: string;
		if (news.length === 0) {
			analysisText = '관련 뉴스를 찾을 수 없습니다.';
		} else {
			try {
				analysisText = await this.llmService.analyzeStockNews(
					stock.name,
					stock.code,
					news,
				);
			} catch (error) {
				this.logger.error(`종목 분석 실패: ${stock.name}`, error);
				analysisText = '분석 생성 실패';
			}
		}

		return {
			stockName: stock.name,
			stockCode: stock.code,
			analysisText,
			news,
		};
	}

	private now(): string {
		return new Date().toLocaleString('ko-KR', {
			timeZone: 'Asia/Seoul',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		});
	}
}
