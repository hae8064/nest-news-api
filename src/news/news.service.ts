import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { formatKoreanDate } from 'src/common/utils/date.util';
import { NewsItem } from './types/news.types';
import { CrawlerService } from 'src/crawler/crawler.service';

@Injectable()
export class NewsService {
	private readonly logger = new Logger(NewsService.name);
	private readonly baseUrl = 'https://openapi.naver.com/v1/search/news.json';
	private readonly clientId: string;
	private readonly clientSecret: string;

	constructor(
		private readonly configService: ConfigService,
		private readonly crawlerService: CrawlerService,
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

				return {
					title: item.title.replace(/<[^>]*>?/gm, ''),
					originallink: item.originallink,
					pubDate: formatKoreanDate(item.pubDate),
					content: content || '',
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
