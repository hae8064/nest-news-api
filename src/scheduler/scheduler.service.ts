import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NewsService } from '../news/news.service';
import { EmailService } from '../email/email.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class SchedulerService {
	private readonly logger = new Logger(SchedulerService.name);

	constructor(
		private readonly newsService: NewsService,
		private readonly emailService: EmailService,
		private readonly subscriptionService: SubscriptionService,
	) {}

	// 매일 오전 7시에 실행 (한국 시간 기준)
	@Cron('0 7 * * *', {
		timeZone: 'Asia/Seoul',
	})
	async sendDailyNewsEmail() {
		this.logger.log('일일 뉴스 이메일 발송 시작');

		try {
			// 경제 뉴스 10개 가져오기
			const economyNews = await this.newsService.fetchNews('경제');
			const economyNews10 = economyNews.slice(0, 10);

			// 부동산 뉴스 10개 가져오기
			const estateNews = await this.newsService.fetchNews('부동산');
			const estateNews10 = estateNews.slice(0, 10);

			// 활성 구독자 목록 가져오기
			const subscribers = await this.subscriptionService.getActiveSubscribers();

			if (subscribers.length === 0) {
				this.logger.warn('구독자가 없습니다.');
				return;
			}

			// 구독자들에게 이메일 발송
			await this.emailService.sendNewsToSubscribers(
				subscribers,
				economyNews10,
				estateNews10,
			);

			this.logger.log('일일 뉴스 이메일 발송 완료');
		} catch (error) {
			this.logger.error('일일 뉴스 이메일 발송 실패', error);
		}
	}
}
