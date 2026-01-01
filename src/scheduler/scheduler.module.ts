import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NewsModule } from '../news/news.module';
import { EmailModule } from '../email/email.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';

@Module({
	imports: [
		ScheduleModule.forRoot(),
		NewsModule,
		EmailModule,
		SubscriptionModule,
	],
	controllers: [SchedulerController],
	providers: [SchedulerService],
})
export class SchedulerModule {}
