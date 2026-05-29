import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';

@Module({
	imports: [ConfigModule],
	providers: [LlmService],
	exports: [LlmService],
	controllers: [LlmController],
})
export class LlmModule {}
