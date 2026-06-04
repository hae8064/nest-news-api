import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NewsService } from '../news/news.service';
import { EmailService } from '../email/email.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { StockAnalysisService } from '../stock/stock-analysis.service';
import { StockPredictionService } from '../stock/stock-prediction.service';

@Injectable()
export class SchedulerService {
	private readonly logger = new Logger(SchedulerService.name);

	constructor(
		private readonly newsService: NewsService,
		private readonly emailService: EmailService,
		private readonly subscriptionService: SubscriptionService,
		private readonly stockAnalysisService: StockAnalysisService,
		private readonly stockPredictionService: StockPredictionService,
		private readonly configService: ConfigService,
	) {}

	@Cron('30 7 * * *', { timeZone: 'Asia/Seoul' })
	async updatePredictionPrices() {
		this.logger.log('예측 실제 가격 업데이트 시작');
		try {
			await this.stockPredictionService.updateActualPrices();
		} catch (error) {
			this.logger.error('예측 실제 가격 업데이트 실패', error);
		}
	}

	@Cron('40 7 * * *', { timeZone: 'Asia/Seoul' })
	async sendDailyStockBriefing() {
		this.logger.log('종목 뉴스 브리핑 발송 시작');

		try {
			const briefing =
				await this.stockAnalysisService.generateDailyBriefing();

			const recipient =
				this.configService.get<string>('STOCK_BRIEFING_RECIPIENT');
			if (!recipient) {
				this.logger.warn('종목 브리핑 수신자가 설정되지 않았습니다.');
				return;
			}

			await this.emailService.sendStockBriefingEmail(recipient, briefing);
			this.logger.log(`종목 뉴스 브리핑 발송 완료: ${recipient}`);
		} catch (error) {
			this.logger.error('종목 뉴스 브리핑 발송 실패', error);
		}
	}

	@Cron('0 10,14 * * 1-5', { timeZone: 'Asia/Seoul' })
	async checkIntradayAlerts() {
		this.logger.log('장중 긴급 뉴스 확인 시작');

		try {
			const alerts = await this.stockAnalysisService.checkUrgentNews();

			if (alerts.length === 0) {
				this.logger.log('긴급 뉴스 없음');
				return;
			}

			const recipient =
				this.configService.get<string>('STOCK_BRIEFING_RECIPIENT');
			if (!recipient) return;

			await this.emailService.sendUrgentAlertEmail(recipient, alerts);
			this.logger.log(
				`긴급 알림 발송: ${alerts.map((a) => a.stockName).join(', ')}`,
			);
		} catch (error) {
			this.logger.error('장중 긴급 뉴스 확인 실패', error);
		}
	}

	@Cron('0 9 * * 6', { timeZone: 'Asia/Seoul' })
	async sendWeeklyReport() {
		this.logger.log('주간 리포트 생성 시작');

		try {
			const { report, generatedAt } =
				await this.stockAnalysisService.generateWeeklyReport();

			const recipient =
				this.configService.get<string>('STOCK_BRIEFING_RECIPIENT');
			if (!recipient) return;

			await this.emailService.sendWeeklyReportEmail(
				recipient,
				report,
				generatedAt,
			);
			this.logger.log(`주간 리포트 발송 완료: ${recipient}`);
		} catch (error) {
			this.logger.error('주간 리포트 발송 실패', error);
		}
	}
}
