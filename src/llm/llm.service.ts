import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { StockPriceDto } from '../stock/dto/stock-price.dto';
import { StockMarketDataDto } from '../stock/dto/stock-market-data.dto';

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
	private readonly model = 'claude-sonnet-4-6';

	private readonly STOCK_EXPERT_SYSTEM = `당신은 20년 경력의 AI 수석 애널리스트입니다.
반도체·IT·전자 섹터 전문가로, 실전 투자에 바로 활용할 수 있는 분석을 제공합니다.

분석 원칙:
- 뉴스의 표면이 아닌 실질적 주가 영향력 판단
- 모든 판단에 확신도(★1~5개) 명시
- 매수/매도 시그널에 타이밍 근거 필수
- 리스크 시나리오 항상 병기
- 확실하지 않으면 솔직히 인정
- 감정이 아닌 데이터와 논리로 판단
- 실전 매매에 바로 쓸 수 있는 직설적 의견`;

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
		priceInfo?: StockPriceDto | null,
		portfolioText?: string,
		marketData?: StockMarketDataDto,
		predictionFeedback?: string,
	): Promise<string> {
		const newsText = newsList
			.map(
				(n, i) =>
					`${i + 1}. [${n.press}] ${n.title} (${n.date})\n${n.content || '(본문 없음)'}`,
			)
			.join('\n\n');

		const priceSection = priceInfo
			? `\n현재가: ${priceInfo.currentPrice}원 | 전일 대비: ${priceInfo.change}원 (${priceInfo.changePercent}%) | 거래량: ${priceInfo.volume}`
			: '';

		const portfolioSection = portfolioText ? `\n\n${portfolioText}` : '';

		let marketDataSection = '';
		if (marketData) {
			const trendRows = marketData.investorTrend
				.map(
					(t) =>
						`| ${t.date} | ${t.foreign} | ${t.institution} | ${t.individual} |`,
				)
				.join('\n');

			const trendTable =
				trendRows.length > 0
					? `\n수급 동향 (최근 5거래일):\n| 날짜 | 외국인 | 기관 | 개인 |\n${trendRows}\n외국인 보유비율: ${marketData.foreignHoldRatio}`
					: '';

			const currentPrice = parseInt(
				(priceInfo?.currentPrice ?? '0').replace(/,/g, ''),
				10,
			);
			const maPosition =
				marketData.ma5 > 0 && marketData.ma20 > 0 && marketData.ma60 > 0
					? currentPrice > marketData.ma5 &&
						currentPrice > marketData.ma20 &&
						currentPrice > marketData.ma60
						? '모든 이동평균선 위 (정배열, 강한 상승 추세)'
						: currentPrice < marketData.ma5 &&
							  currentPrice < marketData.ma20 &&
							  currentPrice < marketData.ma60
							? '모든 이동평균선 아래 (역배열, 강한 하락 추세)'
							: `5일선 ${currentPrice > marketData.ma5 ? '위' : '아래'}, 20일선 ${currentPrice > marketData.ma20 ? '위' : '아래'}, 60일선 ${currentPrice > marketData.ma60 ? '위' : '아래'}`
					: '';

			const fmtPrice = (n: number) => n.toLocaleString('ko-KR');
			const technicalSection =
				marketData.ma5 > 0
					? `\n기술적 지표:\n- 이동평균: 5일 ${fmtPrice(marketData.ma5)} / 20일 ${fmtPrice(marketData.ma20)} / 60일 ${fmtPrice(marketData.ma60)}\n- 현재가 위치: ${maPosition}\n- 거래량: 20일 평균 대비 ${marketData.volumeRatio}%`
					: '';

			marketDataSection = `${trendTable}${technicalSection}`;
		}

		let feedbackSection = '';
		if (predictionFeedback) {
			feedbackSection = `\n\n지난 분석 피드백:\n${predictionFeedback}\n⚠️ 과거 예측이 과도하게 낙관적이었다면 이번 분석에서 보수적으로 조정하세요.`;
		}

		const prompt = `분석 대상: ${stockName}(${stockCode})${priceSection}${portfolioSection}${marketDataSection}${feedbackSection}

최신 뉴스:
${newsText}

⚠️ 중요: 목표가/손절가/물타기 가격 등 모든 금액은 반드시 위에 제시된 현재가를 기준으로 산정하세요.
현재가 대비 ±3~15% 이내의 합리적인 범위여야 합니다. 자릿수를 절대 틀리지 마세요.

다음 형식으로 분석하세요. 뉴스뿐 아니라 수급 동향과 기술적 지표를 종합하여 판단하세요.

【종합 판단】 호재/악재/중립 + 확신도(★1~5개)
핵심 근거 2줄 (뉴스 + 수급/기술적 근거 포함)

【수급 분석】
외국인/기관/개인 매매 동향 해석 + 의미

【매매 시그널】
▶ 단기(1-2주): 매수/매도/보유 + 구체적 근거
▶ 중기(1-3개월): 매수/매도/보유 + 구체적 근거
▶ 목표가: ___원 / 손절: ___원 (현재가 ${priceInfo?.currentPrice ?? '확인불가'}원 기준)

【리스크 시나리오】
이 분석이 틀릴 수 있는 상황 1~2개

【연관 종목】
같은 섹터/공급망에서 동반 영향 받을 종목 2~3개와 이유

【핵심 뉴스】
중요 뉴스 2~3개를 한 줄씩 요약${portfolioText ? `

【보유자 액션 가이드】
⚠️ 아래 보유 현황을 반드시 반영하여 분석하세요.
${portfolioText}
- 추가 매수 / 일부 익절 / 홀딩 / 손절 중 추천 + 근거
- 적정 물타기 가격대 또는 익절 목표가 (현재가 기준)
- 포지션 비중 조정 의견
- 현재 수익률 대비 향후 전략` : ''}

반드시 분석 맨 마지막에 아래 블록을 추가하세요 (데이터 수집용, 생략 금지):
[PREDICTION_DATA]
판단: 호재 또는 악재 또는 중립
확신도: 1~5
단기시그널: 매수 또는 매도 또는 보유
중기시그널: 매수 또는 매도 또는 보유
목표가: 숫자만
손절가: 숫자만
[/PREDICTION_DATA]`;

		return this.callWithRetry(async () => {
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 2000,
				system: this.STOCK_EXPERT_SYSTEM,
				messages: [{ role: 'user', content: prompt }],
			});

			const block = response.content[0];
			return block.type === 'text' ? block.text.trim() : '';
		}, `종목 분석: ${stockName}`);
	}

	async generateMarketSentiment(stockSummaries: string[]): Promise<string> {
		const summaryText = stockSummaries.join('\n\n---\n\n');

		const prompt = `개별 종목 분석 결과:
${summaryText}

위 분석을 종합하여 다음 형식으로 작성하세요:

【시장 총평】
전체 분위기(강세/약세/혼조) + 근거 2~3줄

【섹터별 흐름】
반도체, IT, 전자, 바이오 등 주요 섹터 동향

【오늘의 투자 전략】
▶ 추천 전략: 공격적 매수 / 선별적 매수 / 보수적 관망 / 방어적 포지션
▶ 구체적 액션 1~2개

【주의 사항】
글로벌 매크로 리스크, 주요 이벤트 일정`;

		return this.callWithRetry(async () => {
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 600,
				system: this.STOCK_EXPERT_SYSTEM,
				messages: [{ role: 'user', content: prompt }],
			});

			const block = response.content[0];
			return block.type === 'text' ? block.text.trim() : '';
		}, '시장 종합 평가');
	}

	async discoverHotStocks(
		marketNews: StockNewsItem[],
		watchlistNames: string[],
	): Promise<string> {
		const newsText = marketNews
			.map(
				(n, i) =>
					`${i + 1}. [${n.press}] ${n.title} (${n.date})\n${n.content || ''}`,
			)
			.join('\n\n');

		const prompt = `오늘의 경제/증시 뉴스:
${newsText}

현재 관심 종목 (이미 분석 완료): ${watchlistNames.join(', ')}

위 뉴스를 분석하여, 관심 종목 외에 오늘 주목할만한 종목 3개를 추천하세요.

각 종목을 다음 형식으로:

【추천 1: 종목명】
▶ 주목 이유: 뉴스 근거 포함, 왜 지금인지
▶ 투자 포인트: 핵심 매수 논거
▶ 리스크: 주의할 점
▶ 확신도: ★1~5개

뉴스에서 실제 근거를 찾을 수 있는 종목만 추천하세요. 근거 없는 추천 금지.
참고: 이 브리핑은 장 시작 전(07:05) 발송되며, 수신자는 08:00 장전 시간외 거래부터 매수 가능합니다.
각 종목에 대해 "장전 매수 적합 여부"도 판단해주세요.`;

		return this.callWithRetry(async () => {
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 1000,
				system: this.STOCK_EXPERT_SYSTEM,
				messages: [{ role: 'user', content: prompt }],
			});

			const block = response.content[0];
			return block.type === 'text' ? block.text.trim() : '';
		}, '추천 종목 발굴');
	}

	async assessNewsUrgency(
		stockName: string,
		stockCode: string,
		newsList: StockNewsItem[],
	): Promise<{ urgent: boolean; summary: string }> {
		const newsText = newsList
			.map(
				(n, i) =>
					`${i + 1}. [${n.press}] ${n.title} (${n.date})\n${n.content || ''}`,
			)
			.join('\n\n');

		const prompt = `분석 대상: ${stockName}(${stockCode})

최근 뉴스:
${newsText}

위 뉴스 중 긴급하게 투자자에게 알려야 할 내용이 있는지 판단하세요.

⚠️ 기본값은 N(긴급 아님)입니다. 대부분의 뉴스는 긴급이 아닙니다.
확실한 근거가 있을 때만 Y로 판단하세요. 애매하면 반드시 N입니다.

긴급 기준 (아래 중 하나 이상에 해당하는 "확정된 사실"만 해당):
- 당일 급등/급락 확정 (5% 이상 변동이 실제 발생했거나 확정 공시)
- 공시 확정 사항 (실적 발표 확정, M&A 계약 체결, 대규모 투자 확정, 규제 시행 확정)
- 돌발 사건 확정 (사고 발생, 소송 제기, 수출규제 발동)
- 시장 전체 충격 이벤트 (서킷브레이커, 금리 긴급 변동 등)

긴급이 아닌 것 (절대 Y로 판단하지 마세요):
- 애널리스트 전망, 목표가 변경, 투자의견 변경
- "~할 것으로 예상", "~될 전망", "~가능성" 등 추측성 기사
- 이미 며칠 전 알려진 사실의 재보도
- 업계 동향, 기술 트렌드, 일반적인 시장 분석
- 일상적인 실적 개선/하락, 점진적 변화

다음 형식으로 답하세요:
긴급여부: Y 또는 N
사유: (긴급이면 구체적 이유, 아니면 "특이사항 없음")
액션: (긴급이면 매수/매도/관망 중 추천 + 근거)`;

		return this.callWithRetry(async () => {
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 250,
				system: this.STOCK_EXPERT_SYSTEM,
				messages: [{ role: 'user', content: prompt }],
			});

			const block = response.content[0];
			const text = block.type === 'text' ? block.text.trim() : '';
			const urgent = text.includes('긴급여부: Y');
			return { urgent, summary: text };
		}, `긴급 뉴스 확인: ${stockName}`);
	}

	async generateWeeklyReport(
		stockData: Array<{
			name: string;
			code: string;
			priceInfo: StockPriceDto | null;
			news: StockNewsItem[];
		}>,
	): Promise<string> {
		const summaryText = stockData
			.map((s) => {
				const priceStr = s.priceInfo
					? `현재가: ${s.priceInfo.currentPrice}원 (${s.priceInfo.changePercent}%)`
					: '시세 정보 없음';
				const newsStr = s.news
					.map((n, i) => `${i + 1}. [${n.press}] ${n.title} (${n.date})`)
					.join('\n');
				return `【${s.name}(${s.code})】\n${priceStr}\n\n이번 주 주요 뉴스:\n${newsStr}`;
			})
			.join('\n\n---\n\n');

		const prompt = `이번 주 종목별 현황:
${summaryText}

다음 형식으로 주간 리포트를 작성하세요:

【금주 시장 총평】
이번 주 전체 흐름 요약 3~4줄

【종목별 주간 리뷰】
각 종목의 이번 주 흐름 + 핵심 이벤트 + 주가 변동 요인

【다음 주 전망】
▶ 주요 이벤트/일정 (실적 발표, FOMC, 옵션 만기 등)
▶ 종목별 주간 전략 (매수/매도/보유 + 근거)
▶ 주의할 리스크

【포트폴리오 제안】
현재 보유 종목 비중 조정 의견 + 신규 편입 고려 종목`;

		return this.callWithRetry(async () => {
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: 1500,
				system: this.STOCK_EXPERT_SYSTEM,
				messages: [{ role: 'user', content: prompt }],
			});

			const block = response.content[0];
			return block.type === 'text' ? block.text.trim() : '';
		}, '주간 리포트');
	}
}
