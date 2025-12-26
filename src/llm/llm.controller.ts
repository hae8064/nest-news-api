import { Controller, Get, Body } from '@nestjs/common';
import { LlmService } from './llm.service';

@Controller('llm')
export class LlmController {
	constructor(private readonly llmService: LlmService) {}

	@Get('summarize/economy')
	async summarize(
		@Body() body: { title: string; content: string; pubDate: string },
	) {
		return this.llmService.summarize(body.title, body.content, body.pubDate);
	}

	@Get('summarize/estate')
	async summarizeEstate(
		@Body() body: { title: string; content: string; pubDate: string },
	) {
		return this.llmService.summarize(body.title, body.content, body.pubDate);
	}
}
