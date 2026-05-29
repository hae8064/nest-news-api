import { Controller, Get } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Controller('scheduler')
export class SchedulerController {
	constructor(private readonly schedulerService: SchedulerService) {}

	@Get('test-email')
	async testEmail() {
		await this.schedulerService.sendDailyNewsEmail();
		return { message: '테스트 이메일 발송이 시작되었습니다.' };
	}

	@Get('test-stock-briefing')
	async testStockBriefing() {
		await this.schedulerService.sendDailyStockBriefing();
		return { message: '종목 뉴스 브리핑 테스트 실행됨' };
	}
}
