import { StockNewsItemDto } from './stock-news-item.dto';
import { StockPriceDto } from './stock-price.dto';

export class StockAnalysisDto {
	stockName: string;
	stockCode: string;
	analysisText: string;
	priceInfo: StockPriceDto | null;
	news: StockNewsItemDto[];
}
