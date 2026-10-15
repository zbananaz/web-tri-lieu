'use client';

import type { ArticleDetail } from '@wtl/shared';
import { useRouter } from 'next/navigation';
import { type FormEvent, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { fieldErrors } from '@/lib/forms';
import { Alert, Badge, Button, Card, TextArea, TextField } from './ui';

const TOOLS: { label: string; before: string; after: string; title: string }[] = [
  { label: 'H2', before: '<h2>', after: '</h2>', title: 'Tiêu đề lớn' },
  { label: 'H3', before: '<h3>', after: '</h3>', title: 'Tiêu đề nhỏ' },
  { label: 'B', before: '<strong>', after: '</strong>', title: 'In đậm' },
  { label: 'I', before: '<em>', after: '</em>', title: 'In nghiêng' },
  { label: '• Danh sách', before: '<ul>\n  <li>', after: '</li>\n</ul>', title: 'Danh sách' },
  { label: '“ Trích dẫn', before: '<blockquote>', after: '</blockquote>', title: 'Trích dẫn' },
  { label: 'Liên kết', before: '<a href="https://">', after: '</a>', title: 'Liên kết' },
];

/** Soan bai: HTML tho + xem truoc trong iframe sandbox. May chu van lam sach lai noi dung khi luu. */
export function ArticleEditor({ article }: { article?: ArticleDetail }) {
  const router = useRouter();
  const area = useRef<HTMLTextAreaElement>(null);
  const [html, setHtml] = useState(article?.contentHtml ?? '<p></p>');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState(article?.status ?? 'draft');

  const wrap = (before: string, after: string) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const next = html.slice(0, s) + before + html.slice(s, e) + after + html.slice(e);
    setHtml(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    });
  };

  const readForm = (form: HTMLFormElement) => {
    const f = new FormData(form);
    const slug = String(f.get('slug') ?? '').trim();
    const cover = String(f.get('coverUrl') ?? '').trim();
    return {
      title: String(f.get('title')),
      excerpt: String(f.get('excerpt') ?? ''),
      contentHtml: html,
      coverUrl: cover || null,
      tags: String(f.get('tags') ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      ...(slug ? { slug } : {}),
    };
  };

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = readForm(e.currentTarget);
    setBusy('save');
    setError(null);
    setFields({});
    setSaved(false);
    try {
      if (article) {
        await api(`/admin/articles/${article.id}`, { method: 'PUT', body });
        setSaved(true);
      } else {
        const r = await api<{ article: ArticleDetail }>('/admin/articles', { body });
        router.replace(`/admin/articles/${r.article.id}`);
      }
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const publish = async (to: 'publish' | 'unpublish') => {
    if (!article) return;
    setBusy(to);
    setError(null);
    try {
      const r = await api<{ article: ArticleDetail }>(`/admin/articles/${article.id}/${to}`, { method: 'POST', body: {} });
      setStatus(r.article.status);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <Card className="space-y-4">
        <TextField label="Tiêu đề" name="title" defaultValue={article?.title} required maxLength={200} error={fields.title} />
        <TextArea label="Tóm tắt (hiển thị ở danh sách)" name="excerpt" rows={2} defaultValue={article?.excerpt} maxLength={400} error={fields.excerpt} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Ảnh bìa (URL https)" name="coverUrl" type="url" defaultValue={article?.coverUrl ?? ''} error={fields.coverUrl} />
          <TextField label="Thẻ (cách nhau bằng dấu phẩy)" name="tags" defaultValue={article?.tags.join(', ')} error={fields.tags} />
        </div>
        <TextField label="Đường dẫn (để trống để tự tạo từ tiêu đề)" name="slug" defaultValue={article?.slug} error={fields.slug} hint="Chỉ gồm chữ thường, số và dấu gạch ngang." />
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Định dạng">
          {TOOLS.map((t) => (
            <button key={t.label} type="button" title={t.title} onClick={() => wrap(t.before, t.after)} className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold hover:bg-brand-50">
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label htmlFor="content" className="mb-1.5 block text-sm font-medium">
              Nội dung (HTML)
            </label>
            <textarea
              id="content"
              ref={area}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={18}
              className="w-full rounded-xl border border-line bg-surface p-3 font-mono text-sm focus:border-brand-500"
            />
            {fields.contentHtml && <p className="text-sm text-danger-600">{fields.contentHtml}</p>}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Xem trước</p>
            {/* sandbox rong: khong chay script, khong truy cap origin cua trang quan tri */}
            <iframe
              title="Xem trước bài viết"
              sandbox=""
              srcDoc={`<!doctype html><meta charset="utf-8"><base target="_blank"><style>body{font:16px/1.7 system-ui,sans-serif;margin:12px;color:#1f2a2e}img{max-width:100%}blockquote{border-left:4px solid #2f9488;margin:0;padding-left:12px;color:#5d6b70}</style>${html}`}
              className="h-[26rem] w-full rounded-xl border border-line bg-white"
            />
          </div>
        </div>
      </Card>

      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="ok">Đã lưu bài viết.</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy === 'save'}>
          {article ? 'Lưu thay đổi' : 'Tạo bài viết'}
        </Button>
        {article && (
          <>
            <Badge tone={status === 'published' ? 'ok' : 'warm'}>{status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</Badge>
            {status === 'published' ? (
              <Button variant="secondary" loading={busy === 'unpublish'} onClick={() => publish('unpublish')}>
                Gỡ xuất bản
              </Button>
            ) : (
              <Button variant="secondary" loading={busy === 'publish'} onClick={() => publish('publish')}>
                Xuất bản
              </Button>
            )}
            {status === 'published' && (
              <a href={`/articles/${article.slug}`} target="_blank" rel="noopener" className="text-sm font-semibold text-brand-700 hover:underline">
                Xem trên trang ↗
              </a>
            )}
          </>
        )}
      </div>
    </form>
  );
}
