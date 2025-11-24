import { Controller, Get } from '@nestjs/common';
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
}
