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
	// 경제 뉴스 관련 다양한 키워드
	private readonly economyKeywords = [
		'경제',
		'금융',
		'주식',
		'증시',
		'금리',
		'인플레이션',
		'환율',
		'수출',
		'수입',
		'기업',
		'경영',
	];

	// 부동산 뉴스 관련 다양한 키워드
	private readonly realEstateKeywords = [
		'부동산',
		'아파트',
		'전세',
		'월세',
		'매매',
		'분양',
		'재개발',
		'재건축',
		'토지',
		'상가',
		'오피스텔',
		'주택',
		'건설',
	];

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

	// 제목 유사도 계산 (간단한 문자열 유사도)
	private calculateTitleSimilarity(title1: string, title2: string): number {
		const words1 = title1.replace(/[^\w\s가-힣]/g, '').split(/\s+/);
		const words2 = title2.replace(/[^\w\s가-힣]/g, '').split(/\s+/);

		const set1 = new Set(words1);
		const set2 = new Set(words2);

		const intersection = new Set([...set1].filter((x) => set2.has(x)));
		const union = new Set([...set1, ...set2]);

		return intersection.size / union.size; // Jaccard 유사도
	}

	// 중복 제거 로직
	private removeDuplicates(newsItems: NewsItem[]): NewsItem[] {
		const seenUrls = new Set<string>();
		const uniqueNews: NewsItem[] = [];

		for (const item of newsItems) {
			// URL 정규화 (쿼리 파라미터 제거)
			const normalizedUrl = item.originallink.split('?')[0];

			// URL 중복 체크
			if (seenUrls.has(normalizedUrl)) {
				continue;
			}

			// 제목 유사도 체크 (70% 이상 유사하면 중복으로 간주)
			const isDuplicate = uniqueNews.some((existing) => {
				const similarity = this.calculateTitleSimilarity(
					item.title,
					existing.title,
				);
				return similarity > 0.7;
			});

			if (!isDuplicate) {
				seenUrls.add(normalizedUrl);
				uniqueNews.push(item);
			}
		}

		return uniqueNews;
	}

	// 단일 키워드로 뉴스 검색
	private async fetchNewsByKeyword(
		keyword: string,
		display: number = 20,
	): Promise<NewsItem[]> {
		try {
			const res = await axios.get<{ items: NewsItem[] }>(this.baseUrl, {
				headers: {
					'X-Naver-Client-Id': this.clientId,
					'X-Naver-Client-Secret': this.clientSecret,
				},
				params: {
					query: keyword,
					display: Math.min(display, 100), // 네이버 API 최대 100개
					sort: 'date', // 최신순 정렬 (유사도 순이 아닌)
				},
			});

			return res.data.items || [];
		} catch (error) {
			this.logger.error(`키워드 "${keyword}" 검색 실패:`, error);
			return [];
		}
	}

	async fetchNews(keywords: string[]): Promise<NewsItem[]> {
		// 여러 키워드로 병렬 검색
		const searchPromises = keywords.map((keyword) =>
			this.fetchNewsByKeyword(keyword, 15),
		);

		const results = await Promise.all(searchPromises);
		const allNews = results.flat();

		// 중복 제거
		const uniqueNews = this.removeDuplicates(allNews);

		this.logger.log(
			`총 ${allNews.length}개 뉴스 수집, 중복 제거 후 ${uniqueNews.length}개`,
		);

		// 최신순 정렬 (날짜 기준)
		uniqueNews.sort((a, b) => {
			const dateA = new Date(a.pubDate).getTime();
			const dateB = new Date(b.pubDate).getTime();
			return dateB - dateA; // 최신순
		});

		// 최대 10개만 반환
		return uniqueNews.slice(0, 10);
	}

	async fetchEconomyNews(): Promise<NewsItem[]> {
		// 랜덤하게 5-7개 키워드 선택하여 다양성 확보
		const shuffled = [...this.economyKeywords].sort(() => Math.random() - 0.5);
		const selectedKeywords = shuffled.slice(0, 6);

		this.logger.log(`경제 뉴스 검색 키워드: ${selectedKeywords.join(', ')}`);

		const newsItems = await this.fetchNews(selectedKeywords);

		// 본문 및 요약 생성
		const newsWithContent = await Promise.all(
			newsItems.map(async (item: NewsItem) => {
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
					content: '',
					summary: summary || '요약 없음',
				};
			}),
		);

		return newsWithContent;
	}

	async fetchRealEstateNews(): Promise<NewsItem[]> {
		// 랜덤하게 5-7개 키워드 선택하여 다양성 확보
		const shuffled = [...this.realEstateKeywords].sort(
			() => Math.random() - 0.5,
		);
		const selectedKeywords = shuffled.slice(0, 6);

		this.logger.log(`부동산 뉴스 검색 키워드: ${selectedKeywords.join(', ')}`);

		const newsItems = await this.fetchNews(selectedKeywords);

		// 본문 및 요약 생성
		const newsWithContent = await Promise.all(
			newsItems.map(async (item: NewsItem) => {
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
					content: '',
					summary: summary || '요약 없음',
				};
			}),
		);

		return newsWithContent;
	}
}
