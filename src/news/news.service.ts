import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { formatKoreanDate } from 'src/common/utils/date.util';
import { NewsItem } from './types/news.types';
import { CrawlerService } from 'src/crawler/crawler.service';
import { LlmService } from 'src/llm/llm.service';

@Injectable()
export class NewsService {
	private readonly logger = new Logger(NewsService.name);
	private readonly baseUrl = 'https://openapi.naver.com/v1/search/news.json';
	private readonly clientId: string;
	private readonly clientSecret: string;

	constructor(
		private readonly configService: ConfigService,
		private readonly crawlerService: CrawlerService,
		private readonly llmService: LlmService,
	) {
		// 생성자에서 환경변수 한 번만 읽기
		this.clientId = this.configService.get<string>('NAVER_CLIENT_ID') || '';
		this.clientSecret =
			this.configService.get<string>('NAVER_CLIENT_SECRET') || '';

		if (!this.clientId || !this.clientSecret) {
			throw new BadRequestException(
				'네이버 API 인증 정보가 설정되지 않았습니다. NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET 환경변수를 확인해주세요.',
			);
		}
	}

	async fetchNews(query: string): Promise<NewsItem[]> {
		const res = await axios.get<{ items: NewsItem[] }>(this.baseUrl, {
			headers: {
				'X-Naver-Client-Id': this.clientId,
				'X-Naver-Client-Secret': this.clientSecret,
			},
			params: {
				query,
				display: 5,
				sort: 'date',
			},
		});

		const newsWithContent = await Promise.all(
			res.data.items.map(async (item: NewsItem) => {
				const content =
					(await this.crawlerService.fetchArticleContent(item.originallink)) ||
					item.description?.replace(/<[^>]*>?/gm, '');

				const formattedDate = formatKoreanDate(item.pubDate);
				const title = item.title.replace(/<[^>]*>?/gm, '');

				// LLM으로 요약 생성
				let summary = '';
				try {
					if (content && content.length > 100) {
						summary = await this.llmService.summarize(
							title,
							content,
							formattedDate,
						);
					} else {
						this.logger.warn(
							`요약 건너뜀: ${title} - 본문이 너무 짧음 (${content?.length || 0}자)`,
						);
					}
				} catch (error) {
					this.logger.error(`요약 실패: ${title}`, error);
					summary = '요약 생성 실패';
				}

				return {
					title,
					originallink: item.originallink,
					pubDate: formattedDate,
					summary: summary || '요약 없음',
				};
			}),
		);

		return newsWithContent;
	}

	async fetchEconomyNews() {
		return this.fetchNews('경제');
	}

	async fetchRealEstateNews() {
		return this.fetchNews('부동산');
	}
}
