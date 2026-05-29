import { StockNewsItemDto } from './stock-news-item.dto';

export class StockAnalysisDto {
	stockName: string;
	stockCode: string;
	analysisText: string;
	news: StockNewsItemDto[];
}
