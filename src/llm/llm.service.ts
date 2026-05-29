import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface StockNewsItem {
	title: string;
	link: string;
	press: string;
	date: string;
	content: string;
}

@Injectable()
export class LlmService {
	private readonly logger = new Logger(LlmService.name);
	private client: Anthropic;
	private readonly model = 'claude-haiku-4-5-20251001';

	constructor(private readonly configService: ConfigService) {
		const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
		if (!apiKey) {
			throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
		}
		this.client = new Anthropic({ apiKey });
	}

	private async callWithRetry<T>(
		apiCall: () => Promise<T>,
		operationName: string,
		maxRetries = 2,
	): Promise<T> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				return await apiCall();
			} catch (error: unknown) {
				lastError = error;
				const err = error as { status?: number };

				if (
					err.status === 429 ||
					(err.status !== undefined && err.status >= 500)
				) {
					const wait = attempt * 2000;
					this.logger.warn(
						`${operationName} 재시도중 (${attempt}/${maxRetries}) – ${wait}ms 대기`,
					);
					await new Promise((resolve) => setTimeout(resolve, wait));
					continue;
				}

				this.logger.error(`${operationName} 에러`, error);
				throw error;
			}
		}

		this.logger.error(`${operationName} 실패`, lastError);
		throw lastError;
	}

	async summarize(
		title: string,
		content: string,
		pubDate: string,
	): Promise<string> {
		const prompt = `다음 경제 뉴스를 3~4문장으로 간결하게 요약해줘.
제목: ${title}
기사날짜: ${pubDate}
내용: ${content}`;

		return this.callWithRetry(async () => {
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 200,
				messages: [{ role: 'user', content: prompt }],
			});

			const block = response.content[0];
			return block.type === 'text' ? block.text.trim() : '';
		}, '요약');
	}

	async generateInsights(
		newsList: Array<{ title: string; description: string }>,
	): Promise<string> {
		const newsText = newsList
			.map((n, i) => `${i + 1}. ${n.title}: ${n.description}`)
			.join('\n\n');

		const prompt = `다음 여러 경제 뉴스를 기반으로 최근 경제 흐름과 핵심 인사이트를 3~4문장으로 분석해줘.

뉴스 목록:
${newsText}`;

		return this.callWithRetry(async () => {
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 300,
				messages: [{ role: 'user', content: prompt }],
			});

			const block = response.content[0];
			return block.type === 'text' ? block.text.trim() : '';
		}, '인사이트 생성');
	}

	async analyzeStockNews(
		stockName: string,
		stockCode: string,
		newsList: StockNewsItem[],
	): Promise<string> {
		const newsText = newsList
			.map(
				(n, i) =>
					`${i + 1}. [${n.press}] ${n.title} (${n.date})\n${n.content || '(본문 없음)'}`,
			)
			.join('\n\n');

		const prompt = `당신은 주식 투자 분석 전문가입니다. 아래는 ${stockName}(${stockCode}) 관련 최신 뉴스입니다.

${newsText}

위 뉴스를 바탕으로 다음 형식으로 분석해주세요:
1. 종합 판단: 호재/악재/중립 중 선택하고 근거를 간단히 설명
2. 영향 분석: 주가에 미칠 영향을 2~3문장으로
3. 투자 의견: 매수/매도/보유 중 선택하고 이유 설명
4. 뉴스 요약: 핵심 뉴스 2~3개를 한 줄씩 요약`;

		return this.callWithRetry(async () => {
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 500,
				messages: [{ role: 'user', content: prompt }],
			});

			const block = response.content[0];
			return block.type === 'text' ? block.text.trim() : '';
		}, `종목 분석: ${stockName}`);
	}

	async generateMarketSentiment(stockSummaries: string[]): Promise<string> {
		const summaryText = stockSummaries.join('\n\n');

		const prompt = `당신은 주식 시장 분석 전문가입니다. 아래는 각 종목별 AI 분석 결과입니다.

${summaryText}

위 분석들을 종합하여 전체 시장 분위기와 투자 전략을 3~4문장으로 평가해주세요.
반도체, IT, 전자 등 섹터별 흐름도 언급해주세요.`;

		return this.callWithRetry(async () => {
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 300,
				messages: [{ role: 'user', content: prompt }],
			});

			const block = response.content[0];
			return block.type === 'text' ? block.text.trim() : '';
		}, '시장 종합 평가');
	}
}
