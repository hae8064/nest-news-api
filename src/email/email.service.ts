import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { NewsItem } from '../news/types/news.types';
import { StockBriefingDto } from '../stock/dto/stock-briefing.dto';

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

		return `
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
		.footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>오늘의 뉴스요약</h1>
			<p>${today}</p>
		</div>
		<div class="section">
			<h2 class="section-title">경제 뉴스</h2>
			${economyNews.map((news) => `
			<div class="news-item">
				<div class="news-title">${news.title}</div>
				<div class="news-summary">${news.summary}</div>
				<a href="${news.originallink}" class="news-link">전체 기사 보기</a>
			</div>`).join('')}
		</div>
		<div class="section">
			<h2 class="section-title">부동산 뉴스</h2>
			${estateNews.map((news) => `
			<div class="news-item">
				<div class="news-title">${news.title}</div>
				<div class="news-summary">${news.summary}</div>
				<a href="${news.originallink}" class="news-link">전체 기사 보기</a>
			</div>`).join('')}
		</div>
		<div class="footer">
			<p>이 메일은 구독 신청하신 분께 발송되었습니다.</p>
		</div>
	</div>
</body>
</html>`;
	}

	private generateStockBriefingEmail(briefing: StockBriefingDto): string {
		const today = new Date().toLocaleDateString('ko-KR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			weekday: 'long',
		});

		const stockCards = briefing.analyses
			.map(
				(analysis) => `
		<div style="margin: 20px 0; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
			<h3 style="color: #1a73e8; margin: 0 0 12px 0; font-size: 18px;">${analysis.stockName} (${analysis.stockCode})</h3>
			<div style="color: #333; line-height: 1.8; white-space: pre-line; margin-bottom: 15px;">${analysis.analysisText}</div>
			<div style="border-top: 1px solid #eee; padding-top: 10px;">
				<p style="font-size: 13px; color: #666; margin: 0 0 5px 0; font-weight: bold;">관련 뉴스</p>
				${analysis.news
					.map(
						(n) =>
							`<div style="margin: 4px 0;"><a href="${n.link}" style="color: #1a73e8; text-decoration: none; font-size: 13px;">[${n.press}] ${n.title}</a></div>`,
					)
					.join('')}
			</div>
		</div>`,
			)
			.join('');

		return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: 'Malgun Gothic', sans-serif;">
	<div style="max-width: 700px; margin: 0 auto; padding: 20px;">
		<div style="background: linear-gradient(135deg, #1a73e8, #0d47a1); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;">
			<h1 style="margin: 0; font-size: 22px;">종목 뉴스 브리핑</h1>
			<p style="margin: 8px 0 0 0; opacity: 0.9;">${today}</p>
		</div>

		<div style="background: #f9f9f9; padding: 15px 20px;">
			${stockCards}

			<div style="margin: 25px 0; padding: 20px; background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border-radius: 8px;">
				<h3 style="color: #2e7d32; margin: 0 0 10px 0;">시장 전체 평가</h3>
				<p style="color: #333; line-height: 1.8; margin: 0; white-space: pre-line;">${briefing.marketSentiment}</p>
			</div>
		</div>

		<div style="background: #f0f0f0; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 11px; color: #999;">
			<p style="margin: 0;">${StockBriefingDto.DISCLAIMER}</p>
			<p style="margin: 5px 0 0 0;">생성 시간: ${briefing.generatedAt}</p>
		</div>
	</div>
</body>
</html>`;
	}

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
				subject: `오늘의 뉴스 요약 - ${new Date().toLocaleDateString('ko-KR')}`,
				html,
			});

			this.logger.log(`이메일 발송 성공: ${to}`);
		} catch (error) {
			this.logger.error(`이메일 발송 실패: ${to}`, error);
			throw error;
		}
	}

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

		const successCount = results.filter(
			(r) => r.status === 'fulfilled',
		).length;
		const failCount = results.filter((r) => r.status === 'rejected').length;

		this.logger.log(
			`이메일 발송 완료: 성공 ${successCount}건, 실패 ${failCount}건`,
		);
	}

	async sendStockBriefingEmail(
		to: string,
		briefing: StockBriefingDto,
	): Promise<void> {
		try {
			const html = this.generateStockBriefingEmail(briefing);

			await this.transporter.sendMail({
				from: this.configService.get<string>('SMTP_FROM'),
				to,
				subject: `종목 뉴스 브리핑 - ${new Date().toLocaleDateString('ko-KR')}`,
				html,
			});

			this.logger.log(`종목 브리핑 이메일 발송 성공: ${to}`);
		} catch (error) {
			this.logger.error(`종목 브리핑 이메일 발송 실패: ${to}`, error);
			throw error;
		}
	}
}
