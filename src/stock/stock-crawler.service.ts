import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CrawlerService } from '../crawler/crawler.service';
import { StockNewsItemDto } from './dto/stock-news-item.dto';

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
