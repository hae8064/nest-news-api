import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { NewsItem } from '../news/types/news.types';

@Injectable()
export class EmailService {
	private readonly logger = new Logger(EmailService.name);
	private transporter: nodemailer.Transporter;

	constructor(private readonly configService: ConfigService) {
		this.transporter = nodemailer.createTransport({
			host: this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com',
			port: this.configService.get<number>('SMTP_PORT') || 587,
			secure: false,
			auth: {
				user: this.configService.get<string>('SMTP_USER'),
				pass: this.configService.get<string>('SMTP_PASS'),
			},
		});
	}

	/**
	 * 뉴스 이메일 생성
	 */
	private generateNewsEmail(
		economyNews: NewsItem[],
		estateNews: NewsItem[],
	): string {
		const today = new Date().toLocaleDateString('ko-KR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			weekday: 'long',
		});

		const html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 800px; margin: 0 auto; padding: 20px; }
		.header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
		.section { margin: 30px 0; }
		.section-title { font-size: 24px; font-weight: bold; color: #2c3e50; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; margin-bottom: 20px; }
		.news-item { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #4CAF50; }
		.news-title { font-size: 18px; font-weight: bold; color: #2c3e50; margin-bottom: 10px; }
		.news-summary { color: #555; margin: 10px 0; line-height: 1.8; }
		.news-link { color: #4CAF50; text-decoration: none; font-weight: bold; }
		.news-link:hover { text-decoration: underline; }
		.footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>📰 오늘의 경제 뉴스</h1>
			<p>${today}</p>
		</div>

		<div class="section">
			<h2 class="section-title">💰 경제 뉴스</h2>
			${economyNews
				.map(
					(news) => `
			<div class="news-item">
				<div class="news-title">${news.title}</div>
				<div class="news-summary">${news.summary}</div>
				<a href="${news.originallink}" class="news-link">전체 기사 보기 →</a>
			</div>
			`,
				)
				.join('')}
		</div>

		<div class="section">
			<h2 class="section-title">🏠 부동산 뉴스</h2>
			${estateNews
				.map(
					(news) => `
			<div class="news-item">
				<div class="news-title">${news.title}</div>
				<div class="news-summary">${news.summary}</div>
				<a href="${news.originallink}" class="news-link">전체 기사 보기 →</a>
			</div>
			`,
				)
				.join('')}
		</div>

		<div class="footer">
			<p>이 메일은 구독 신청하신 분께 발송되었습니다.</p>
			<p>구독 취소를 원하시면 링크를 클릭해주세요.</p>
		</div>
	</div>
</body>
</html>
		`;

		return html;
	}

	/**
	 * 뉴스 이메일 발송
	 */
	async sendNewsEmail(
		to: string,
		economyNews: NewsItem[],
		estateNews: NewsItem[],
	): Promise<void> {
		try {
			const html = this.generateNewsEmail(economyNews, estateNews);

			await this.transporter.sendMail({
				from: this.configService.get<string>('SMTP_FROM'),
				to,
				subject: `📰 오늘의 경제 뉴스 - ${new Date().toLocaleDateString('ko-KR')}`,
				html,
			});

			this.logger.log(`이메일 발송 성공: ${to}`);
		} catch (error) {
			this.logger.error(`이메일 발송 실패: ${to}`, error);
			throw error;
		}
	}

	/**
	 * 여러 구독자에게 일괄 발송
	 */
	async sendNewsToSubscribers(
		subscribers: string[],
		economyNews: NewsItem[],
		estateNews: NewsItem[],
	): Promise<void> {
		const results = await Promise.allSettled(
			subscribers.map((email) =>
				this.sendNewsEmail(email, economyNews, estateNews),
			),
		);

		const successCount = results.filter((r) => r.status === 'fulfilled').length;
		const failCount = results.filter((r) => r.status === 'rejected').length;

		this.logger.log(
			`이메일 발송 완료: 성공 ${successCount}건, 실패 ${failCount}건`,
		);
	}
}
