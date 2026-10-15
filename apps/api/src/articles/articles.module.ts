import { Module } from '@nestjs/common';
import { AdminArticlesController, ArticlesController } from './articles.controller.js';
import { ArticlesService } from './articles.service.js';

@Module({
  controllers: [ArticlesController, AdminArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
