import { Controller, Get } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Controller('scheduler')
export class SchedulerController {
	constructor(private readonly schedulerService: SchedulerService) {}

	@Get('test-stock-briefing')
	async testStockBriefing() {
		await this.schedulerService.sendDailyStockBriefing();
		return { message: '종목 뉴스 브리핑 테스트 실행됨' };
	}

	@Get('test-intraday-alert')
	async testIntradayAlert() {
		await this.schedulerService.checkIntradayAlerts();
		return { message: '장중 긴급 알림 테스트 실행됨' };
	}

	@Get('test-weekly-report')
	async testWeeklyReport() {
		await this.schedulerService.sendWeeklyReport();
		return { message: '주간 리포트 테스트 실행됨' };
	}
}
