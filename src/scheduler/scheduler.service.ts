import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NewsService } from '../news/news.service';
import { EmailService } from '../email/email.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { StockAnalysisService } from '../stock/stock-analysis.service';

@Injectable()
export class SchedulerService {
	private readonly logger = new Logger(SchedulerService.name);

	constructor(
		private readonly newsService: NewsService,
		private readonly emailService: EmailService,
		private readonly subscriptionService: SubscriptionService,
		private readonly stockAnalysisService: StockAnalysisService,
		private readonly configService: ConfigService,
	) {}

	@Cron('0 7 * * *', { timeZone: 'Asia/Seoul' })
	async sendDailyNewsEmail() {
		this.logger.log('일일 뉴스 이메일 발송 시작');

		try {
			const economyNews = await this.newsService.fetchEconomyNews();
			const estateNews = await this.newsService.fetchRealEstateNews();

			const subscribers =
				await this.subscriptionService.getActiveSubscribers();

			if (subscribers.length === 0) {
				this.logger.warn('구독자가 없습니다.');
				return;
			}

			await this.emailService.sendNewsToSubscribers(
				subscribers,
				economyNews,
				estateNews,
			);

			this.logger.log('일일 뉴스 이메일 발송 완료');
		} catch (error) {
			this.logger.error('일일 뉴스 이메일 발송 실패', error);
		}
	}

	@Cron('5 7 * * *', { timeZone: 'Asia/Seoul' })
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
}
