import { Controller, Post, Delete, Body, Get, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { GetSubscribersResponse } from './dto/response/getSubscribersResponse';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { UserRole } from 'src/common/enums/userRole.enum';

@Controller('subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SubscriptionController {
	constructor(private readonly subscriptionService: SubscriptionService) {}

	@Get('subscribers')
	async getSubscribers(): Promise<GetSubscribersResponse> {
		const emails = await this.subscriptionService.getActiveSubscribers();
		return {
			subscribers: emails,
			count: emails.length,
		};
	}

	@Post('subscribe')
	async subscribe(@Body('email') email: string) {
		return this.subscriptionService.subscribe(email);
	}

	@Delete('unsubscribe')
	async unsubscribe(@Body('email') email: string) {
		await this.subscriptionService.unsubscribe(email);
		return { message: '구독이 취소되었습니다.' };
	}

	@Get('test')
	test() {
		return '구독 서비스가 정상 작동 중입니다.';
	}
}
