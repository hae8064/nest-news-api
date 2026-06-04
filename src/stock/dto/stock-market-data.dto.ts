export class InvestorTrendItem {
  date: string;
  foreign: string;
  institution: string;
  individual: string;
}

export class StockMarketDataDto {
  investorTrend: InvestorTrendItem[];
  foreignHoldRatio: string;
  ma5: number;
  ma20: number;
  ma60: number;
  volumeRatio: number;
}
