import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { LlmModule } from 'src/llm/llm.module';
import { CrawlerModule } from 'src/crawler/crawler.module';

@Module({
	imports: [LlmModule, CrawlerModule],
	controllers: [NewsController],
	providers: [NewsService],
	exports: [NewsService],
})
export class NewsModule {}
