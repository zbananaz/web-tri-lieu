'use client';

import { CASE_STATUS_LABELS, type CaseStatus, type PublicExpert } from '@wtl/shared';
import { type ReactNode, useId, useState } from 'react';
import { caseTone, formatDateTime } from '@/lib/format';
import { Avatar } from './cards';
import { Alert, Badge, Card } from './ui';

export interface Hotline {
  number: string;
  label: string;
}

export const StatusBadge = ({ status }: { status: CaseStatus }) => <Badge tone={caseTone(status)}>{CASE_STATUS_LABELS[status]}</Badge>;

export function HotlineAlert({ hotlines }: { hotlines: Hotline[] }) {
  if (hotlines.length === 0) return null;
  return (
    <Alert tone="danger">
      <p className="font-semibold">Nếu bạn đang cảm thấy không an toàn, hãy liên hệ ngay:</p>
      <ul className="mt-1 list-disc pl-5">
        {hotlines.map((h) => (
          <li key={h.number}>
            {h.label}:{' '}
            <a href={`tel:${h.number}`} className="font-bold underline">
              {h.number}
            </a>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

export function Timeline({ events }: { events: { toStatus: CaseStatus; createdAt: string; note?: string | null }[] }) {
  return (
    <ol className="space-y-3 border-l-2 border-brand-100 pl-4">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span aria-hidden className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-brand-500" />
          <p className="font-medium">{CASE_STATUS_LABELS[e.toStatus]}</p>
          <p className="text-xs text-muted">{formatDateTime(e.createdAt)}</p>
          {e.note && <p className="mt-0.5 text-sm text-muted">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export function AnswersView({ answers }: { answers: { prompt: string; labels: string[]; text?: string }[] }) {
  return (
    <dl className="space-y-3">
      {answers.map((a, i) => (
        <div key={i}>
          <dt className="text-sm text-muted">{a.prompt}</dt>
          <dd className="font-medium">{[...a.labels, a.text].filter(Boolean).join(', ') || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ExpertSummary({ expert }: { expert: PublicExpert }) {
  return (
    <Card className="flex items-center gap-4">
      <Avatar name={expert.fullName} url={expert.avatarUrl} size={64} />
      <div className="min-w-0">
        <p className="text-sm text-muted">Chuyên gia của bạn</p>
        <p className="truncate text-lg font-bold">{expert.fullName}</p>
        <p className="truncate text-sm text-muted">{expert.headline}</p>
      </div>
    </Card>
  );
}

export function Tabs({ tabs }: { tabs: { id: string; label: string; badge?: number; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const base = useId();
  return (
    <div>
      <div role="tablist" aria-label="Mục chi tiết" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`${base}-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-p-${t.id}`}
            onClick={() => setActive(t.id)}
            className={`-mb-px min-h-11 whitespace-nowrap border-b-2 px-4 text-sm font-semibold ${active === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t.label}
            {!!t.badge && <span className="ml-1.5 rounded-full bg-danger-600 px-1.5 text-xs text-white">{t.badge}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-p-${t.id}`} aria-labelledby={`${base}-${t.id}`} hidden={active !== t.id}>
          {active === t.id && t.content}
        </div>
      ))}
    </div>
  );
}
