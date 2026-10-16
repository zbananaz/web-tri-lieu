'use client';

import type { PreferredMode, PublicQuestion } from '@wtl/shared';
import Link from 'next/link';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Photo } from '@/components/Photo';
import { Alert, Button, Card, LinkButton, Loading, PageTitle, SelectField, TextArea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@/lib/hooks';

interface Hotline {
  number: string;
  label: string;
}
type Answers = Record<string, string | string[]>;
interface Result {
  id: string;
  riskLevel: string;
  hotlines: Hotline[];
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
      <aside className="lg:col-span-4">
        <div className="lg:sticky lg:top-24">
          <Photo name="langNghe" eager sizes="(min-width: 1024px) 30vw, 100vw" className="aspect-[16/10] rounded-[2rem] shadow-soft lg:aspect-[4/5]" />
          <div className="mt-5 space-y-2">
            <p className="font-[family-name:var(--font-display)] text-xl text-brand-700">Hãy cứ chậm rãi</p>
            <p className="text-sm text-muted">
              Không có câu trả lời đúng hay sai. Chỉ cần nói thật với mình ở thời điểm này. Bạn có thể bỏ qua các câu không bắt buộc.
            </p>
          </div>
        </div>
      </aside>
      <div className="lg:col-span-8">{children}</div>
    </div>
  );
}

function HotlineBox({ hotlines }: { hotlines: Hotline[] }) {
  return (
    <Alert tone="danger">
      <p className="font-semibold">Nếu bạn đang gặp nguy hiểm, hãy liên hệ ngay:</p>
      <ul className="mt-1 list-disc pl-5">
        {hotlines.map((h) => (
          <li key={h.number}>
            {h.label}: <a href={`tel:${h.number}`} className="font-bold underline">{h.number}</a>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

function Question({ q, value, onChange }: { q: PublicQuestion; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  if (q.type === 'text') {
    return <TextArea label={q.prompt + (q.required ? '' : ' (không bắt buộc)')} hint={q.helpText ?? undefined} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
  const multi = q.type === 'multi';
  const selected = multi ? ((value as string[]) ?? []) : [(value as string) ?? ''];
  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-semibold">
        {q.prompt}
        {!q.required && <span className="font-normal text-muted"> (không bắt buộc)</span>}
      </legend>
      {q.helpText && <p className="text-sm text-muted">{q.helpText}</p>}
      <div className="grid gap-2">
        {q.options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <label
              key={o.value}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-2.5 ${on ? 'border-brand-600 bg-brand-50' : 'border-line bg-surface hover:bg-brand-50/50'}`}
            >
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={q.id}
                value={o.value}
                checked={on}
                className="size-4 accent-brand-600"
                onChange={() => onChange(multi ? (on ? selected.filter((v) => v !== o.value) : [...selected, o.value]) : o.value)}
              />
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function ScreeningPage() {
  const { user, loading } = useAuth();
  const qs = useQuery<{ questions: PublicQuestion[]; hotlines: Hotline[] }>('/screening/questions');
  const [answers, setAnswers] = useState<Answers>({});
  const [concerns, setConcerns] = useState('');
  const [mode, setMode] = useState<PreferredMode>('any');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  if (loading || qs.loading) return <Loading />;

  if (!user) {
    return (
      <Shell>
      <Card className="text-center lg:mt-8">
        <h1 className="text-2xl font-bold">Bắt đầu sàng lọc</h1>
        <p className="mt-2 text-muted">
          Để câu trả lời được lưu riêng tư và bạn có thể theo dõi kết quả, vui lòng tạo tài khoản hoặc đăng nhập. Mất chưa đến 5 phút.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton href="/register?next=/screening">Tạo tài khoản</LinkButton>
          <LinkButton href="/login?next=/screening" variant="secondary">
            Đăng nhập
          </LinkButton>
        </div>
      </Card>
      </Shell>
    );
  }
  if (user.role !== 'client') {
    return <Alert tone="brand">Bài sàng lọc dành cho tài khoản khách hàng.</Alert>;
  }
  if (qs.error || !qs.data) return <Alert>{qs.error ?? 'Không tải được câu hỏi.'}</Alert>;

  if (result) {
    return (
      <Shell>
      <Card className="space-y-4 text-center lg:mt-8">
        <h1 className="text-2xl font-bold">Cảm ơn bạn đã chia sẻ</h1>
        <p className="text-muted">Hồ sơ của bạn đã được gửi. Đội ngũ sẽ xem xét và ghép bạn với chuyên gia phù hợp.</p>
        {result.hotlines.length > 0 && <div className="text-left"><HotlineBox hotlines={result.hotlines} /></div>}
        <LinkButton href={`/me/cases/${result.id}`}>Xem hồ sơ của tôi</LinkButton>
      </Card>
      </Shell>
    );
  }

  const questions = qs.data.questions;
  const missing = questions.find((q) => {
    const v = answers[q.id];
    return q.required && (v === undefined || v === '' || (Array.isArray(v) && v.length === 0));
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (missing) {
      setError(`Vui lòng trả lời: "${missing.prompt}"`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<Result>('/cases', {
        body: {
          answers: Object.entries(answers)
            .filter(([, v]) => v !== '' && !(Array.isArray(v) && v.length === 0))
            .map(([questionId, value]) => ({ questionId, value })),
          concerns,
          preferredMode: mode,
        },
      });
      setResult(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <PageTitle title="Sàng lọc ban đầu" />
      <p className="mb-6 text-muted">
        Câu trả lời chỉ được dùng để hiểu nhu cầu của bạn và ghép chuyên gia phù hợp. Bạn có thể bỏ qua các câu không bắt buộc.
      </p>
      <form onSubmit={submit} className="space-y-6" noValidate>
        {questions.map((q) => (
          <Card key={q.id}>
            <Question q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
          </Card>
        ))}
        <Card className="space-y-4">
          <TextArea label="Bạn muốn chia sẻ thêm điều gì? (không bắt buộc)" value={concerns} maxLength={2000} onChange={(e) => setConcerns(e.target.value)} />
          <SelectField label="Hình thức trị liệu mong muốn" value={mode} onChange={(e) => setMode(e.target.value as PreferredMode)}>
            <option value="any">Linh hoạt</option>
            <option value="online">Trực tuyến</option>
            <option value="in_person">Trực tiếp</option>
          </SelectField>
        </Card>
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Link href="/" className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-muted hover:underline">
            Để sau
          </Link>
          <Button type="submit" loading={busy} className="px-8">
            Gửi hồ sơ
          </Button>
        </div>
        <HotlineBox hotlines={qs.data.hotlines} />
      </form>
    </Shell>
  );
}
