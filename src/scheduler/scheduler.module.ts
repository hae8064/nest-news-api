import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { NewsModule } from '../news/news.module';
import { EmailModule } from '../email/email.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { StockModule } from '../stock/stock.module';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';

@Module({
	imports: [
		ScheduleModule.forRoot(),
		ConfigModule,
		NewsModule,
		EmailModule,
		SubscriptionModule,
		StockModule,
	],
	controllers: [SchedulerController],
	providers: [SchedulerService],
})
export class SchedulerModule {}
