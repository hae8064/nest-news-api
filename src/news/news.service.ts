import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { LlmService } from '../llm/llm.service';
import { formatKoreanDate } from 'src/common/utils/date.util';

@Injectable()
export class NewsService {
	private readonly logger = new Logger(NewsService.name);
	private baseUrl = 'https://openapi.naver.com/v1/search/news.json';

	constructor(private readonly llmService: LlmService) {}

	async fetchNews(query: string) {
		const clientId = process.env.NAVER_CLIENT_ID;
		const clientSecret = process.env.NAVER_CLIENT_SECRET;

		if (!clientId || !clientSecret) {
			throw new BadRequestException(
				'네이버 API 인증 정보가 설정되지 않았습니다. NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET 환경변수를 확인해주세요.',
			);
		}

		const res = await axios.get(this.baseUrl, {
			headers: {
				'X-Naver-Client-Id': clientId,
				'X-Naver-Client-Secret': clientSecret,
			},
			params: {
				query,
				display: 1,
				sort: 'sim',
			},
		});

		return res.data.items.map((item: any) => ({
			title: item.title.replace(/<[^>]*>?/gm, ''),
			originallink: item.originallink,
			pubDate: formatKoreanDate(item.pubDate),
		}));
	}

	async fetchEconomyNews() {
		return this.fetchNews('경제');
	}

	async fetchRealEstateNews() {
		return this.fetchNews('부동산');
	}

	// 지연 함수
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	// LLM 분석을 안전하게 실행 (에러 핸들링 포함)
	private async safeAnalyzeNewsItem(news: any) {
		try {
			const [summary, insights] = await Promise.all([
				this.llmService.summarize(news.title, news.description).catch((err) => {
					this.logger.error(`요약 실패: ${news.title}`, err?.message || err);
					return '';
				}),
				this.llmService
					.generateInsights([
						{ title: news.title, description: news.description },
					])
					.catch((err) => {
						this.logger.error(
							`인사이트 실패: ${news.title}`,
							err?.message || err,
						);
						return '';
					}),
			]);

			return {
				...news,
				summary: summary || '요약 실패',
				insights: insights || '인사이트 실패',
			};
		} catch (error) {
			this.logger.error(`뉴스 분석 실패: ${news.title}`, error);
			// 에러 발생 시 기본값 반환
			return {
				...news,
				summary: '분석 실패',
				insights: '인사이트 실패',
			};
		}
	}

	// LLM을 활용한 뉴스 분석 (개선된 버전 - 배치 처리 및 Rate Limit 핸들링)
	async analyzeNews(query: string) {
		const newsList = await this.fetchNews(query);

		// 배치 크기 설정 (한 번에 처리할 뉴스 수)
		const batchSize = 2; // 한 번에 2개씩 처리 (10개 API 호출)
		const analyzedNews: any[] = [];

		// 배치로 나누어 처리
		for (let i = 0; i < newsList.length; i += batchSize) {
			const batch = newsList.slice(i, i + batchSize);

			this.logger.log(
				`배치 ${Math.floor(i / batchSize) + 1} 처리 중... (${batch.length}개)`,
			);

			// 배치 내 뉴스들을 병렬 처리
			const batchResults = await Promise.all(
				batch.map((news) => this.safeAnalyzeNewsItem(news)),
			);

			analyzedNews.push(...batchResults);

			// 마지막 배치가 아니면 지연 (Rate Limit 방지)
			if (i + batchSize < newsList.length) {
				await this.delay(1000); // 1초 대기
			}
		}

		// 중요도 순으로 정렬
		analyzedNews.sort((a, b) => b.importance - a.importance);

		return analyzedNews;
	}

	// 뉴스 인사이트 생성
	async getNewsInsights(query: string) {
		try {
			const newsList = await this.fetchNews(query);
			const insights = await this.llmService.generateInsights(newsList);

			return {
				insights,
				newsCount: newsList.length,
				analyzedAt: new Date().toISOString(),
			};
		} catch (error) {
			this.logger.error('인사이트 생성 실패', error);
			throw new BadRequestException('인사이트 생성 중 오류가 발생했습니다.');
		}
	}

	// 경제 뉴스 분석
	async analyzeEconomyNews() {
		return this.analyzeNews('경제');
	}

	// 부동산 뉴스 분석
	async analyzeRealEstateNews() {
		return this.analyzeNews('부동산');
	}
}
