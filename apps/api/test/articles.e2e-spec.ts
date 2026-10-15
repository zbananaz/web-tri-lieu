import type { NestExpressApplication } from '@nestjs/platform-express';
import { eq } from 'drizzle-orm';
import type { Db } from '../src/db/client.js';
import { DB } from '../src/db/db.module.js';
import { articles, auditLogs } from '../src/db/schema.js';
import { ORIGIN, createTestApp, createUser, loginAs, request, resetDb } from './helpers.js';

describe('Bai viet', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(app);
  });

  async function setup() {
    const admin = await loginAs(app, await createUser(app, 'admin'));
    const expert = await loginAs(app, await createUser(app, 'expert'));
    const client = await loginAs(app, await createUser(app, 'client'));
    return { admin, expert, client };
  }
  const input = (over: object = {}) => ({
    title: 'Cách ngủ ngon hơn mỗi đêm',
    excerpt: 'Vài thói quen đơn giản',
    contentHtml: '<h2>Giấc ngủ</h2><p>Nội dung <strong>bài viết</strong></p>',
    tags: ['giac-ngu'],
    ...over,
  });
  const create = (agent: Awaited<ReturnType<typeof loginAs>>, body: object) =>
    agent.post('/api/admin/articles').set('Origin', ORIGIN).send(body);

  it('chi admin moi quan ly bai viet', async () => {
    const s = await setup();
    expect((await create(s.client, input())).status).toBe(403);
    expect((await create(s.expert, input())).status).toBe(403);
    expect((await request(app.getHttpServer()).post('/api/admin/articles').set('Origin', ORIGIN).send(input())).status).toBe(401);
    expect((await s.client.get('/api/admin/articles')).status).toBe(403);
    expect((await create(s.admin, input())).status).toBe(201);
  });

  it('ban nhap khong lo ra cong khai; xuat ban thi hien, go xuat ban thi an lai', async () => {
    const s = await setup();
    const created = await create(s.admin, input());
    const { id, slug } = created.body.article;
    expect(slug).toBe('cach-ngu-ngon-hon-moi-dem'); // slug khong dau

    const pub = request(app.getHttpServer());
    expect((await pub.get('/api/articles')).body.articles).toHaveLength(0);
    expect((await pub.get(`/api/articles/${slug}`)).status).toBe(404);

    const published = await s.admin.post(`/api/admin/articles/${id}/publish`).set('Origin', ORIGIN).send({});
    expect(published.status).toBe(200);
    expect(published.body.article.publishedAt).toBeTruthy();
    const list = await pub.get('/api/articles');
    expect(list.body.articles).toHaveLength(1);
    expect(list.body.articles[0]).not.toHaveProperty('contentHtml');
    const detail = await pub.get(`/api/articles/${slug}`);
    expect(detail.status).toBe(200);
    expect(detail.body.article.contentHtml).toContain('<strong>bài viết</strong>');

    await s.admin.post(`/api/admin/articles/${id}/unpublish`).set('Origin', ORIGIN).send({});
    expect((await pub.get(`/api/articles/${slug}`)).status).toBe(404);
  });

  it('lam sach HTML o may chu: script, su kien, javascript:, iframe bi loai', async () => {
    const s = await setup();
    const evil =
      '<p onclick="alert(1)">Xin chào</p><script>alert(2)</script><iframe src="https://evil.example"></iframe>' +
      '<a href="javascript:alert(3)">bấm</a><a href="https://ok.example" target="_blank">tốt</a>' +
      '<img src="x" onerror="alert(4)"><img src="data:text/html;base64,AAAA"><img src="https://ok.example/a.png" style="x">' +
      '<style>body{display:none}</style>';
    const res = await create(s.admin, input({ contentHtml: evil }));
    expect(res.status).toBe(201);
    const html: string = res.body.article.contentHtml;
    expect(html).not.toMatch(/<script|<iframe|<style|onclick|onerror|javascript:|data:|style=/i);
    expect(html).toContain('Xin chào');
    expect(html).toContain('href="https://ok.example"');
    expect(html).toMatch(/rel="noopener noreferrer nofollow"/);
    expect(html).toContain('src="https://ok.example/a.png"');
    // Du lieu trong DB cung da duoc lam sach
    const db = app.get<Db>(DB);
    const [row] = await db.select().from(articles);
    expect(row!.contentHtml).not.toMatch(/<script|onerror/i);
  });

  it('kiem tra du lieu dau vao', async () => {
    const s = await setup();
    expect((await create(s.admin, input({ title: 'ab' }))).status).toBe(400);
    expect((await create(s.admin, input({ contentHtml: '' }))).status).toBe(400);
    expect((await create(s.admin, input({ coverUrl: 'javascript:alert(1)' }))).status).toBe(400);
    expect((await create(s.admin, input({ slug: 'Sai Slug!' }))).status).toBe(400);
    expect((await create(s.admin, input({ tags: new Array(9).fill('a') }))).status).toBe(400);
  });

  it('slug tu sinh khong trung; slug tu chon bi trung thi 409', async () => {
    const s = await setup();
    const a = await create(s.admin, input());
    const b = await create(s.admin, input());
    expect(a.body.article.slug).toBe('cach-ngu-ngon-hon-moi-dem');
    expect(b.body.article.slug).toBe('cach-ngu-ngon-hon-moi-dem-2');
    expect((await create(s.admin, input({ slug: 'cach-ngu-ngon-hon-moi-dem' }))).status).toBe(409);
  });

  it('sua bai: cap nhat noi dung, giu nguyen slug neu khong gui; xoa duoc; moi thao tac co audit', async () => {
    const s = await setup();
    const { id, slug } = (await create(s.admin, input())).body.article;
    const upd = await s.admin
      .put(`/api/admin/articles/${id}`)
      .set('Origin', ORIGIN)
      .send(input({ title: 'Tieu de moi hoan toan', tags: ['a', 'a', 'b'] }));
    expect(upd.status).toBe(200);
    expect(upd.body.article).toMatchObject({ slug, title: 'Tieu de moi hoan toan', tags: ['a', 'b'] });
    expect((await s.admin.put('/api/admin/articles/00000000-0000-4000-8000-000000000000').set('Origin', ORIGIN).send(input())).status).toBe(404);
    expect((await s.client.put(`/api/admin/articles/${id}`).set('Origin', ORIGIN).send(input())).status).toBe(403);

    expect((await s.admin.delete(`/api/admin/articles/${id}`).set('Origin', ORIGIN)).status).toBe(200);
    expect((await s.admin.get(`/api/admin/articles/${id}`)).status).toBe(404);

    const db = app.get<Db>(DB);
    const rows = await db.select({ action: auditLogs.action }).from(auditLogs).where(eq(auditLogs.entity, 'article'));
    expect(rows.map((r) => r.action).sort()).toEqual(['article.create', 'article.delete', 'article.update']);
  });

  it('loc theo tag va phan trang', async () => {
    const s = await setup();
    for (let i = 1; i <= 3; i++) {
      const c = await create(s.admin, input({ title: `Bai so ${i}`, tags: i === 3 ? ['khac'] : ['giac-ngu'] }));
      await s.admin.post(`/api/admin/articles/${c.body.article.id}/publish`).set('Origin', ORIGIN).send({});
    }
    const pub = request(app.getHttpServer());
    const tagged = await pub.get('/api/articles?tag=giac-ngu');
    expect(tagged.body.total).toBe(2);
    const paged = await pub.get('/api/articles?pageSize=2&page=2');
    expect(paged.body.articles).toHaveLength(1);
    expect(paged.body.total).toBe(3);
    expect((await pub.get('/api/articles?pageSize=9999')).status).toBe(400);
    expect((await pub.get('/api/articles/Sai%20Slug')).status).toBe(400);
  });
});
