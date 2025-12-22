import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NewsModule } from './news/news.module';
import { ConfigModule } from '@nestjs/config';
import { LlmModule } from './llm/llm.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ['.env', '.env.dev'],
		}),
		// TypeOrmModule.forRoot({
		//   type: 'postgres',
		//   host: process.env.DB_HOST,
		//   port: parseInt(process.env.DB_PORT ?? '5432'),
		//   username: process.env.DB_USERNAME,
		//   password: process.env.DB_PASSWORD,
		//   database: process.env.DB_NAME,
		//   entities: [News],
		//   synchronize: true,
		// }),
		NewsModule,
		LlmModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
