import type { ArticleSummary, PublicExpert } from '@wtl/shared';
import Link from 'next/link';
import { formatDate, formatDateTime, formatVnd, MODE_LABELS } from '@/lib/format';
import { LeafMark } from './LeafMark';
import { ARTICLE_PHOTOS, Photo } from './Photo';
import { Badge } from './ui';

export function Avatar({ name, url, size = 56 }: { name: string; url?: string | null; size?: number }) {
  const initials = name
    .replace(/^(ThS|TS|CN|BS|PGS)\.?\s+/i, '')
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-700"
      style={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      {initials}
    </span>
  );
}

export function Stars({ value, size = 'size-4' }: { value: number; size?: string }) {
  return (
    <span aria-hidden className="inline-flex text-warm-600">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={size} fill={value >= i - 0.25 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4">
          <path d="m10 2.5 2.2 4.8 5.3.6-3.9 3.6 1.1 5.2L10 14l-4.7 2.7 1.1-5.2L2.5 7.9l5.3-.6z" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}

export function RatingLine({ rating }: { rating: PublicExpert['rating'] }) {
  if (!rating) return <span className="text-sm text-muted">Chưa có đánh giá</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm" title={`${rating.avg.toFixed(1)} trên 5 sao`}>
      <Stars value={rating.avg} />
      <span className="font-semibold">{rating.avg.toFixed(1)}</span>
      <span className="text-muted">({rating.count} đánh giá)</span>
    </span>
  );
}

export function ExpertCard({ e }: { e: PublicExpert }) {
  return (
    <Link
      href={`/experts/${e.id}`}
      className="flex h-full flex-col gap-3 rounded-3xl border border-line/70 bg-surface p-5 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="flex items-center gap-3">
        <Avatar name={e.fullName} url={e.avatarUrl} />
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{e.fullName}</h3>
          <p className="line-clamp-2 text-sm text-muted">{e.headline}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {e.specialties.slice(0, 4).map((s) => (
          <Badge key={s.slug} tone="brand">
            {s.name}
          </Badge>
        ))}
      </div>
      <RatingLine rating={e.rating} />
      {e.nextSlot && <p className="text-sm font-medium text-ok-600">Giờ trống gần nhất: {formatDateTime(e.nextSlot)}</p>}
      <p className="mt-auto flex flex-wrap justify-between gap-x-3 text-sm text-muted">
        <span>{e.yearsExperience} năm kinh nghiệm</span>
        <span>
          {e.modes.map((m) => MODE_LABELS[m] ?? m).join(' · ')} · {formatVnd(e.feeVnd)}
        </span>
      </p>
    </Link>
  );
}

/** `featured`: thẻ nằm ngang (ảnh trái, chữ phải) từ màn hình sm trở lên, dùng cho bài đầu danh sách. */
export function ArticleCard({ a, featured }: { a: ArticleSummary; featured?: boolean }) {
  const photo = ARTICLE_PHOTOS[a.slug];
  const frame = featured ? 'aspect-[16/9] sm:aspect-auto sm:h-full sm:min-h-[16rem] sm:w-[46%] sm:shrink-0' : 'aspect-[16/9] w-full';
  const sizes = featured ? '(min-width: 1024px) 400px, (min-width: 640px) 45vw, 100vw' : '(min-width: 1024px) 360px, (min-width: 640px) 45vw, 100vw';
  return (
    <Link
      href={`/articles/${a.slug}`}
      className={`flex h-full flex-col overflow-hidden rounded-3xl border border-line/70 bg-surface shadow-soft transition duration-300 hover:-translate-y-0.5 hover:shadow-lift ${featured ? 'sm:flex-row' : ''}`}
    >
      {a.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.coverUrl} alt="" loading="lazy" className={`${frame} object-cover`} />
      ) : photo ? (
        <Photo name={photo} sizes={sizes} className={frame} />
      ) : (
        <div aria-hidden className={`grid place-items-center bg-gradient-to-br from-brand-100 to-warm-100 text-brand-600 ${frame}`}>
          <LeafMark className="size-12 opacity-70" />
        </div>
      )}
      <div className={`flex flex-1 flex-col gap-2 p-5 ${featured ? 'sm:justify-center sm:p-8' : ''}`}>
        <div className="flex flex-wrap gap-1.5">
          {a.tags.slice(0, 2).map((t) => (
            <Badge key={t}>{t.replace(/-/g, ' ')}</Badge>
          ))}
        </div>
        <h3 className={`font-semibold leading-snug ${featured ? 'text-xl sm:text-2xl' : 'text-lg'}`}>{a.title}</h3>
        <p className="line-clamp-3 text-sm text-muted">{a.excerpt}</p>
        {a.publishedAt && <p className="mt-auto pt-2 text-xs text-muted">{formatDate(a.publishedAt)}</p>}
      </div>
    </Link>
  );
}
