import { Controller, Get, Query } from '@nestjs/common';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('economy')
  getEconomyNews() {
    return this.newsService.fetchEconomyNews();
  }

  @Get('estate')
  getEstateNews() {
    return this.newsService.fetchRealEstateNews();
  }

  // LLM 분석이 포함된 뉴스
  @Get('economy/analyze')
  async getAnalyzedEconomyNews() {
    return this.newsService.analyzeEconomyNews();
  }

  @Get('estate/analyze')
  async getAnalyzedEstateNews() {
    return this.newsService.analyzeRealEstateNews();
  }

  // 뉴스 인사이트
  @Get('insights')
  async getInsights(@Query('query') query: string = '경제') {
    return this.newsService.getNewsInsights(query);
  }

  // 커스텀 쿼리 분석
  @Get('analyze')
  async analyzeNews(@Query('query') query: string) {
    if (!query) {
      return { error: 'query 파라미터가 필요합니다.' };
    }
    return this.newsService.analyzeNews(query);
  }
}
