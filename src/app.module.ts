import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NewsModule } from './news/news.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LlmModule } from './llm/llm.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './subscription/subscription.entity';
import { EmailModule } from './email/email.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { CrawlerModule } from './crawler/crawler.module';
import { AuthModule } from './auth/auth.module';
import { User } from './auth/user.entity';
import { StockModule } from './stock/stock.module';
import { StockWatchlist } from './stock/stock.entity';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ['.env', '.env.dev', '.env.prod'],
		}),
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService) => ({
				type: 'postgres',
				host: configService.get<string>('DB_HOST'),
				port: parseInt(configService.get<string>('DB_PORT') ?? '5432'),
				username: configService.get<string>('DB_USERNAME'),
				password: configService.get<string>('DB_PASSWORD'),
				database: configService.get<string>('DB_NAME'),
				entities: [Subscription, User, StockWatchlist],
				synchronize: true,
			}),
			inject: [ConfigService],
		}),
		NewsModule,
		LlmModule,
		EmailModule,
		SubscriptionModule,
		SchedulerModule,
		CrawlerModule,
		AuthModule,
		StockModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
