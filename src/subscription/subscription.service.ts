import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './subscription.entity';

@Injectable()
export class SubscriptionService {
	private readonly logger = new Logger(SubscriptionService.name);

	constructor(
		@InjectRepository(Subscription)
		private readonly subscriptionRepository: Repository<Subscription>,
	) {}

	async subscribe(email: string): Promise<Subscription> {
		const existing = await this.subscriptionRepository.findOne({
			where: { email },
		});

		if (existing) {
			if (existing.isActive) {
				throw new ConflictException('이미 구독 중인 이메일입니다.');
			}
			existing.isActive = true;
			return this.subscriptionRepository.save(existing);
		}

		const subscription = this.subscriptionRepository.create({
			email,
			isActive: true,
		});

		return this.subscriptionRepository.save(subscription);
	}

	async unsubscribe(email: string): Promise<void> {
		const subscription = await this.subscriptionRepository.findOne({
			where: { email },
		});

		if (subscription) {
			subscription.isActive = false;
			await this.subscriptionRepository.save(subscription);
		} else {
			throw new NotFoundException('구독 정보를 찾을 수 없습니다.');
		}
	}

	async getActiveSubscribers(): Promise<string[]> {
		const subscriptions = await this.subscriptionRepository.find({
			where: { isActive: true },
		});

		return subscriptions.map((s) => s.email);
	}
}
