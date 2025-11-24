import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { News } from './news.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  //   imports: [TypeOrmModule.forFeature([News])],
  imports: [],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
