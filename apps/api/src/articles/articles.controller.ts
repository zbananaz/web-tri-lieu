import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { type ArticleInput, type AuthUser, articleInputSchema } from '@wtl/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Public, Roles } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ArticlesService } from './articles.service.js';

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(9),
  tag: z.string().trim().min(1).max(30).optional(),
});
const slugParam = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);

@Controller()
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Public()
  @Get('articles')
  list(@Query(new ZodPipe(listQuery)) q: z.infer<typeof listQuery>) {
    return this.articles.listPublic(q.page, q.pageSize, q.tag);
  }

  @Public()
  @Get('articles/:slug')
  async detail(@Param('slug', new ZodPipe(slugParam)) slug: string) {
    return { article: await this.articles.getPublic(slug) };
  }
}

@Roles('admin')
@Controller('admin/articles')
export class AdminArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  async list() {
    return { articles: await this.articles.listAdmin() };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { article: await this.articles.getAdmin(id) };
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(articleInputSchema)) body: ArticleInput,
    @Req() req: Request,
  ) {
    return { article: await this.articles.create(user.id, body, req.ip) };
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(articleInputSchema)) body: ArticleInput,
    @Req() req: Request,
  ) {
    return { article: await this.articles.update(user.id, id, body, req.ip) };
  }

  @HttpCode(200)
  @Post(':id/publish')
  async publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return { article: await this.articles.setPublished(user.id, id, true, req.ip) };
  }

  @HttpCode(200)
  @Post(':id/unpublish')
  async unpublish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return { article: await this.articles.setPublished(user.id, id, false, req.ip) };
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.articles.remove(user.id, id, req.ip);
  }
}
