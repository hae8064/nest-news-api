import { StockAnalysisDto } from './stock-analysis.dto';

export class StockBriefingDto {
	analyses: StockAnalysisDto[];
	marketSentiment: string;
	generatedAt: string;

	static readonly DISCLAIMER =
		'본 분석은 AI가 뉴스 기반으로 자동 생성한 것으로, 투자 조언이 아닙니다.';
}
