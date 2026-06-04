import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { StockCrawlerService } from './stock-crawler.service';
import { StockWatchlistService } from './stock-watchlist.service';
import { StockPortfolioService } from './stock-portfolio.service';
import { StockPredictionService } from './stock-prediction.service';
import { StockAnalysisDto } from './dto/stock-analysis.dto';
import { StockBriefingDto } from './dto/stock-briefing.dto';
import { StockMarketDataDto } from './dto/stock-market-data.dto';
import { StockWatchlist } from './stock.entity';

@Injectable()
export class StockAnalysisService {
	private readonly logger = new Logger(StockAnalysisService.name);

	constructor(
		private readonly stockCrawlerService: StockCrawlerService,
		private readonly llmService: LlmService,
		private readonly stockWatchlistService: StockWatchlistService,
		private readonly stockPortfolioService: StockPortfolioService,
		private readonly stockPredictionService: StockPredictionService,
	) {}

	async generateDailyBriefing(): Promise<StockBriefingDto> {
		this.logger.log('종목 브리핑 생성 시작');

		const watchlist = await this.stockWatchlistService.getActiveStocks();
		if (watchlist.length === 0) {
			this.logger.warn('감시 종목이 없습니다.');
			return {
				analyses: [],
				marketSentiment: '감시 종목 없음',
				hotStocks: '',
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

		let hotStocks = '';
		try {
			const marketNews = await this.stockCrawlerService.fetchMarketNews();
			if (marketNews.length > 0) {
				const watchlistNames = watchlist.map((s) => s.name);
				hotStocks = await this.llmService.discoverHotStocks(
					marketNews,
					watchlistNames,
				);
			}
		} catch (error) {
			this.logger.error('추천 종목 발굴 실패', error);
		}

		this.logger.log('종목 브리핑 생성 완료');

		return {
			analyses,
			marketSentiment,
			hotStocks,
			generatedAt: this.now(),
		};
	}

	private async analyzeStock(stock: StockWatchlist): Promise<StockAnalysisDto> {
		this.logger.log(`종목 분석 시작: ${stock.name} (${stock.code})`);

		const [news, priceInfo, positions, investorData, technicals] =
			await Promise.all([
				this.stockCrawlerService.fetchStockNews(stock.name, stock.code),
				this.stockCrawlerService.fetchStockPrice(stock.code),
				this.stockPortfolioService.getPositionsByCode(stock.code),
				this.stockCrawlerService.fetchInvestorTrend(stock.code),
				this.stockCrawlerService.fetchTechnicalIndicators(stock.code),
			]);

		let portfolioText = '';
		let currentPrice = 0;
		if (priceInfo) {
			currentPrice = parseInt(
				priceInfo.currentPrice.replace(/,/g, ''),
				10,
			);
			if (positions.length > 0 && !isNaN(currentPrice)) {
				portfolioText =
					this.stockPortfolioService.buildPortfolioSummary(
						positions,
						currentPrice,
					);
			}
		}

		let marketData: StockMarketDataDto | undefined;
		if (investorData.items.length > 0 || technicals) {
			marketData = {
				investorTrend: investorData.items,
				foreignHoldRatio: investorData.foreignHoldRatio,
				ma5: technicals?.ma5 ?? 0,
				ma20: technicals?.ma20 ?? 0,
				ma60: technicals?.ma60 ?? 0,
				volumeRatio: technicals?.volumeRatio ?? 0,
			};
		}

		const predictionFeedback =
			await this.stockPredictionService.getRecentFeedback(stock.code);

		let analysisText: string;
		if (news.length === 0) {
			analysisText = '관련 뉴스를 찾을 수 없습니다.';
		} else {
			try {
				analysisText = await this.llmService.analyzeStockNews(
					stock.name,
					stock.code,
					news,
					priceInfo,
					portfolioText,
					marketData,
					predictionFeedback,
				);
			} catch (error) {
				this.logger.error(`종목 분석 실패: ${stock.name}`, error);
				analysisText = '분석 생성 실패';
			}
		}

		if (analysisText !== '분석 생성 실패' && analysisText !== '관련 뉴스를 찾을 수 없습니다.') {
			await this.stockPredictionService.savePrediction(
				analysisText,
				stock.code,
				stock.name,
				isNaN(currentPrice) ? 0 : currentPrice,
			);
			analysisText = analysisText
				.replace(/\[PREDICTION_DATA\][\s\S]*?\[\/PREDICTION_DATA\]/, '')
				.trim();
		}

		return {
			stockName: stock.name,
			stockCode: stock.code,
			analysisText,
			priceInfo,
			news,
		};
	}

	async checkUrgentNews(): Promise<
		Array<{ stockName: string; stockCode: string; summary: string }>
	> {
		this.logger.log('장중 긴급 뉴스 확인 시작');

		const watchlist = await this.stockWatchlistService.getActiveStocks();
		const results = await Promise.all(
			watchlist.map(async (stock) => {
				const news = await this.stockCrawlerService.fetchStockNews(
					stock.name,
					stock.code,
				);
				if (news.length === 0) return null;

				try {
					const result = await this.llmService.assessNewsUrgency(
						stock.name,
						stock.code,
						news,
					);
					if (result.urgent) {
						return {
							stockName: stock.name,
							stockCode: stock.code,
							summary: result.summary,
						};
					}
				} catch (error) {
					this.logger.error(
						`긴급 뉴스 확인 실패: ${stock.name}`,
						error,
					);
				}
				return null;
			}),
		);

		const alerts = results.filter(
			(r): r is NonNullable<typeof r> => r !== null,
		);
		this.logger.log(`긴급 뉴스 확인 완료: ${alerts.length}건`);
		return alerts;
	}

	async generateWeeklyReport(): Promise<{
		report: string;
		generatedAt: string;
	}> {
		this.logger.log('주간 리포트 생성 시작');

		const watchlist = await this.stockWatchlistService.getActiveStocks();
		const stockData = await Promise.all(
			watchlist.map(async (stock) => {
				const [priceInfo, news] = await Promise.all([
					this.stockCrawlerService.fetchStockPrice(stock.code),
					this.stockCrawlerService.fetchStockNews(stock.name, stock.code),
				]);
				return { name: stock.name, code: stock.code, priceInfo, news };
			}),
		);

		const report = await this.llmService.generateWeeklyReport(stockData);
		this.logger.log('주간 리포트 생성 완료');

		return { report, generatedAt: this.now() };
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
