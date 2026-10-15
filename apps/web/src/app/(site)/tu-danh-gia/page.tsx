'use client';

import { ASSESSMENT_CHOICES, ASSESSMENT_KINDS, ASSESSMENTS, type AssessmentKind, scoreAssessment } from '@wtl/shared';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { HotlineAlert } from '@/components/case';
import { Alert, Button, Card, LinkButton, PageTitle } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@/lib/hooks';

const SHORT: Record<AssessmentKind, string> = { phq9: 'PHQ-9 · Trầm cảm', gad7: 'GAD-7 · Lo âu' };

export default function SelfAssessmentPage() {
  const { user } = useAuth();
  const hot = useQuery<{ hotlines: { number: string; label: string }[] }>('/screening/questions');
  const [kind, setKind] = useState<AssessmentKind>('phq9');
  const [answers, setAnswers] = useState<Record<AssessmentKind, (number | undefined)[]>>({ phq9: [], gad7: [] });
  const [done, setDone] = useState<AssessmentKind | null>(null);
  const [missing, setMissing] = useState(false);
  const [share, setShare] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const def = ASSESSMENTS[kind];
  const current = answers[kind];

  const pick = (i: number, v: number) => {
    setAnswers((a) => {
      const next = [...a[kind]];
      next[i] = v;
      return { ...a, [kind]: next };
    });
    setMissing(false);
    // Doi cau tra loi thi ket qua cu khong con dung nua
    setDone(null);
    setSaved(false);
  };

  const switchKind = (k: AssessmentKind) => {
    setKind(k);
    setDone(null);
    setSaved(false);
    setSaveError(null);
    setMissing(false);
  };

  const complete = (): number[] | null => {
    const out: number[] = [];
    for (let i = 0; i < def.items.length; i++) {
      const v = current[i];
      if (v === undefined) return null;
      out.push(v);
    }
    return out;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!complete()) {
      setMissing(true);
      return;
    }
    setDone(kind);
    setSaved(false);
    setSaveError(null);
  };

  const full = complete();
  const result = done === kind && full ? scoreAssessment(kind, full) : null;

  const save = async () => {
    if (!full) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api('/assessments', { body: { kind, answers: full, shared: share } });
      setSaved(true);
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageTitle title="Tự đánh giá tâm trạng" />
      <Alert tone="brand">
        Đây là công cụ sàng lọc tham khảo, <strong>không phải chẩn đoán</strong> và không thay thế đánh giá của chuyên gia. Phần câu hỏi và cách diễn đạt đang ở bản nháp, chờ chuyên gia lâm sàng thẩm định.
      </Alert>

      <div role="tablist" aria-label="Chọn bảng câu hỏi" className="flex gap-2">
        {ASSESSMENT_KINDS.map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={kind === k}
            onClick={() => switchKind(k)}
            className={`min-h-11 flex-1 rounded-full border px-4 text-sm font-semibold ${kind === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface hover:bg-brand-50'}`}
          >
            {SHORT[k]}
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">{def.title}</h2>
          <p className="mt-1 text-muted">{def.intro}</p>
        </div>
        {def.items.map((text, i) => (
          <Card key={text} className="!p-4 sm:!p-5">
            <fieldset>
              <legend className="font-medium">
                {i + 1}. {text}
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {ASSESSMENT_CHOICES.map((c) => {
                  const on = current[i] === c.value;
                  return (
                    <label
                      key={c.value}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-2 text-sm ${on ? 'border-brand-600 bg-brand-50' : 'border-line bg-surface hover:bg-brand-50/50'}`}
                    >
                      <input type="radio" name={`${kind}-${i}`} value={c.value} checked={on} onChange={() => pick(i, c.value)} className="size-4 accent-brand-600" />
                      {c.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </Card>
        ))}
        {missing && <Alert>Vui lòng trả lời tất cả các câu để xem kết quả.</Alert>}
        <Button type="submit" className="w-full sm:w-auto">
          Xem kết quả
        </Button>
      </form>

      {result && (
        <section aria-live="polite" className="space-y-4">
          <Card className="space-y-2 bg-brand-50">
            <p className="text-sm text-muted">Điểm của bạn</p>
            <p className="text-4xl font-bold" data-testid="assessment-score">
              {result.score}
              <span className="text-lg font-medium text-muted"> / {def.maxScore}</span>
            </p>
            <p className="text-lg font-semibold">Mức độ: {result.label}</p>
            <p className="text-sm text-muted">Kết quả chỉ mang tính tham khảo. Nếu bạn lo lắng về cảm xúc của mình, hãy chia sẻ với một chuyên gia.</p>
          </Card>
          {result.urgent && (
            <>
              <Alert tone="warm">Kết quả cho thấy bạn nên gặp chuyên gia sớm. Nếu bạn có ý nghĩ làm hại bản thân, hãy liên hệ ngay một trong các số dưới đây.</Alert>
              <HotlineAlert hotlines={hot.data?.hotlines ?? []} />
            </>
          )}
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/screening">Bắt đầu sàng lọc để gặp chuyên gia</LinkButton>
            <LinkButton href="/experts" variant="secondary">
              Xem đội ngũ chuyên gia
            </LinkButton>
          </div>
          {user?.role === 'client' ? (
            <Card className="space-y-3">
              <h3 className="font-semibold">Lưu vào nhật ký của bạn</h3>
              {saved ? (
                <Alert tone="ok">
                  Đã lưu. Xem lại tại{' '}
                  <Link href="/me/mood" className="font-semibold underline">
                    Nhật ký tâm trạng
                  </Link>
                  .
                </Alert>
              ) : (
                <>
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
                    <span>Chia sẻ kết quả này với chuyên gia đang theo dõi tôi (có thể đổi lại sau).</span>
                  </label>
                  {saveError && <Alert>{saveError}</Alert>}
                  <Button variant="secondary" onClick={save} loading={saving}>
                    Lưu kết quả
                  </Button>
                </>
              )}
            </Card>
          ) : (
            !user && (
              <p className="text-sm text-muted">
                <Link href="/login?next=/tu-danh-gia" className="font-semibold text-brand-700 underline">
                  Đăng nhập
                </Link>{' '}
                để lưu kết quả và theo dõi diễn biến theo thời gian.
              </p>
            )
          )}
        </section>
      )}
    </div>
  );
}
