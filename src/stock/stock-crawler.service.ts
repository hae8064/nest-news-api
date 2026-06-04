import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CrawlerService } from '../crawler/crawler.service';
import { StockNewsItemDto } from './dto/stock-news-item.dto';
import { StockPriceDto } from './dto/stock-price.dto';
import {
	StockMarketDataDto,
	InvestorTrendItem,
} from './dto/stock-market-data.dto';

@Injectable()
export class StockCrawlerService {
	private readonly logger = new Logger(StockCrawlerService.name);
	private readonly clientId: string;
	private readonly clientSecret: string;
	private readonly MAX_ARTICLES = 5;

	constructor(
		private readonly configService: ConfigService,
		private readonly crawlerService: CrawlerService,
	) {
		this.clientId = this.configService.get<string>('NAVER_CLIENT_ID') || '';
		this.clientSecret =
			this.configService.get<string>('NAVER_CLIENT_SECRET') || '';
	}

	async fetchStockNews(
		stockName: string,
		stockCode: string,
	): Promise<StockNewsItemDto[]> {
		this.logger.log(`종목 뉴스 크롤링 시작: ${stockName} (${stockCode})`);

		try {
			const res = await axios.get<{ items: any[] }>(
				'https://openapi.naver.com/v1/search/news.json',
				{
					headers: {
						'X-Naver-Client-Id': this.clientId,
						'X-Naver-Client-Secret': this.clientSecret,
					},
					params: {
						query: stockName,
						display: 10,
						sort: 'sim',
					},
				},
			);

			const items = res.data.items || [];
			const uniqueItems = this.removeDuplicates(items);
			const selected = uniqueItems.slice(0, this.MAX_ARTICLES);

			const newsItems: StockNewsItemDto[] = await Promise.all(
				selected.map(async (item) => {
					let content = '';
					try {
						content = await this.crawlerService.fetchArticleContent(
							item.originallink,
						);
					} catch {
						this.logger.warn(`본문 크롤링 실패: ${item.originallink}`);
					}

					return {
						title: item.title.replace(/<[^>]*>/g, ''),
						link: item.originallink,
						press: this.extractPress(item.originallink),
						date: this.formatDate(item.pubDate),
						content: content
							? content.substring(0, 2000)
							: item.description?.replace(/<[^>]*>/g, '') || '',
					};
				}),
			);

			this.logger.log(
				`종목 뉴스 크롤링 완료: ${stockName} - ${newsItems.length}개`,
			);
			return newsItems;
		} catch (error) {
			this.logger.error(`종목 뉴스 크롤링 실패: ${stockName}`, error);
			return [];
		}
	}

	async fetchStockPrice(code: string): Promise<StockPriceDto | null> {
		const headers = {
			'User-Agent':
				'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
		};

		try {
			const [basicRes, integrationRes] = await Promise.all([
				axios.get(
					`https://m.stock.naver.com/api/stock/${code}/basic`,
					{ headers, timeout: 10000 },
				),
				axios
					.get(
						`https://m.stock.naver.com/api/stock/${code}/integration`,
						{ headers, timeout: 10000 },
					)
					.catch(() => null),
			]);

			const basic = basicRes.data;
			const totalInfos: Array<{ code: string; value: string }> =
				integrationRes?.data?.totalInfos ?? [];
			const volume =
				totalInfos.find((i) => i.code === 'accumulatedTradingVolume')
					?.value ?? '';

			return {
				currentPrice: this.formatPrice(basic.closePrice),
				change: this.formatPrice(basic.compareToPreviousClosePrice),
				changePercent: basic.fluctuationsRatio ?? '',
				volume: this.formatPrice(volume),
			};
		} catch (error) {
			this.logger.warn(`시세 조회 실패: ${code}`, error?.['message']);
			return null;
		}
	}

	async fetchMarketNews(): Promise<StockNewsItemDto[]> {
		this.logger.log('시장 뉴스 크롤링 시작');

		const queries = [
			'국내증시 급등 종목 테마',
			'실적 호전 어닝서프라이즈',
			'외국인 기관 순매수 종목',
			'반도체 AI 바이오 수혜주',
		];

		try {
			const allResponses = await Promise.all(
				queries.map((query) =>
					axios
						.get<{ items: any[] }>(
							'https://openapi.naver.com/v1/search/news.json',
							{
								headers: {
									'X-Naver-Client-Id': this.clientId,
									'X-Naver-Client-Secret': this.clientSecret,
								},
								params: { query, display: 5, sort: 'date' },
							},
						)
						.then((res) => res.data.items || [])
						.catch(() => []),
				),
			);

			const items = allResponses.flat();
			const uniqueItems = this.removeDuplicates(items);
			const selected = uniqueItems.slice(0, 8);

			const newsItems: StockNewsItemDto[] = await Promise.all(
				selected.map(async (item) => {
					let content = '';
					try {
						content = await this.crawlerService.fetchArticleContent(
							item.originallink,
						);
					} catch {
						this.logger.warn(`본문 크롤링 실패: ${item.originallink}`);
					}

					return {
						title: item.title.replace(/<[^>]*>/g, ''),
						link: item.originallink,
						press: this.extractPress(item.originallink),
						date: this.formatDate(item.pubDate),
						content: content
							? content.substring(0, 2000)
							: item.description?.replace(/<[^>]*>/g, '') || '',
					};
				}),
			);

			this.logger.log(`시장 뉴스 크롤링 완료: ${newsItems.length}개`);
			return newsItems;
		} catch (error) {
			this.logger.error('시장 뉴스 크롤링 실패', error);
			return [];
		}
	}

	async fetchInvestorTrend(
		code: string,
	): Promise<{ items: InvestorTrendItem[]; foreignHoldRatio: string }> {
		const headers = {
			'User-Agent':
				'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
		};

		try {
			const res = await axios.get(
				`https://m.stock.naver.com/api/stock/${code}/trend`,
				{ headers, timeout: 10000, params: { pageSize: 5 } },
			);

			const rawItems: any[] = res.data ?? [];
			const items = rawItems.map((item) => ({
				date: this.formatTrendDate(item.bizdate),
				foreign: item.foreignerPureBuyQuant ?? '',
				institution: item.organPureBuyQuant ?? '',
				individual: item.individualPureBuyQuant ?? '',
			}));
			const foreignHoldRatio =
				rawItems[0]?.foreignerHoldRatio ?? '';

			return { items, foreignHoldRatio };
		} catch (error) {
			this.logger.warn(`수급 데이터 조회 실패: ${code}`, error?.['message']);
			return { items: [], foreignHoldRatio: '' };
		}
	}

	async fetchTechnicalIndicators(
		code: string,
	): Promise<{ ma5: number; ma20: number; ma60: number; volumeRatio: number } | null> {
		const headers = {
			'User-Agent':
				'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
		};

		try {
			const end = new Date();
			const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
			const fmt = (d: Date) =>
				`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

			const res = await axios.get(
				`https://api.stock.naver.com/chart/domestic/item/${code}/day`,
				{
					headers,
					timeout: 10000,
					params: {
						startDateTime: fmt(start),
						endDateTime: fmt(end),
					},
				},
			);

			const candles: Array<{
				closePrice: number;
				accumulatedTradingVolume: number;
			}> = res.data ?? [];

			if (candles.length === 0) return null;

			const closes = candles.map((c) => c.closePrice);
			const volumes = candles.map((c) => c.accumulatedTradingVolume);

			const ma = (arr: number[], period: number): number => {
				if (arr.length < period) return 0;
				const slice = arr.slice(arr.length - period);
				return Math.round(slice.reduce((a, b) => a + b, 0) / period);
			};

			const avgVolume20 = ma(volumes, 20);
			const todayVolume = volumes[volumes.length - 1] ?? 0;

			return {
				ma5: ma(closes, 5),
				ma20: ma(closes, 20),
				ma60: ma(closes, 60),
				volumeRatio:
					avgVolume20 > 0
						? Math.round((todayVolume / avgVolume20) * 100)
						: 0,
			};
		} catch (error) {
			this.logger.warn(`차트 데이터 조회 실패: ${code}`, error?.['message']);
			return null;
		}
	}

	private formatTrendDate(bizdate: string): string {
		if (!bizdate || bizdate.length !== 8) return bizdate ?? '';
		return `${bizdate.slice(4, 6)}/${bizdate.slice(6, 8)}`;
	}

	private formatPrice(value: string | undefined): string {
		if (!value) return '';
		const num = parseInt(value.replace(/,/g, ''), 10);
		return isNaN(num) ? value : num.toLocaleString('ko-KR');
	}

	private removeDuplicates(items: any[]): any[] {
		const unique: any[] = [];

		for (const item of items) {
			const title = item.title.replace(/<[^>]*>/g, '');
			const isDuplicate = unique.some((existing) => {
				const existingTitle = existing.title.replace(/<[^>]*>/g, '');
				return this.jaccardSimilarity(title, existingTitle) > 0.7;
			});

			if (!isDuplicate) {
				unique.push(item);
			}
		}

		return unique;
	}

	private jaccardSimilarity(a: string, b: string): number {
		const wordsA = new Set(a.replace(/[^\w\s가-힣]/g, '').split(/\s+/));
		const wordsB = new Set(b.replace(/[^\w\s가-힣]/g, '').split(/\s+/));

		const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
		const union = new Set([...wordsA, ...wordsB]);

		return union.size === 0 ? 0 : intersection.size / union.size;
	}

	private extractPress(url: string): string {
		const pressMap: Record<string, string> = {
			'chosun.com': '조선일보',
			'donga.com': '동아일보',
			'joongang.co.kr': '중앙일보',
			'hani.co.kr': '한겨레',
			'khan.co.kr': '경향신문',
			'hankyung.com': '한국경제',
			'mk.co.kr': '매일경제',
			'sedaily.com': '서울경제',
			'edaily.co.kr': '이데일리',
			'mt.co.kr': '머니투데이',
			'yna.co.kr': '연합뉴스',
			'ytn.co.kr': 'YTN',
			'sbs.co.kr': 'SBS',
			'kbs.co.kr': 'KBS',
			'mbc.co.kr': 'MBC',
			'newsis.com': '뉴시스',
			'news1.kr': '뉴스1',
			'etnews.com': '전자신문',
			'zdnet.co.kr': 'ZDNet',
			'bloter.net': '블로터',
		};

		try {
			const hostname = new URL(url).hostname;
			for (const [domain, name] of Object.entries(pressMap)) {
				if (hostname.includes(domain)) return name;
			}
		} catch {}

		return '기타';
	}

	private formatDate(pubDate: string): string {
		try {
			const date = new Date(pubDate);
			return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
		} catch {
			return pubDate;
		}
	}
}
