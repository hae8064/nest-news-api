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

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ['.env', '.env.dev'],
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
				entities: [Subscription],
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
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
