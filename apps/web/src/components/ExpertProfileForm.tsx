'use client';

import type { PublicExpert } from '@wtl/shared';
import { type FormEvent, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { fieldErrors } from '@/lib/forms';
import { useQuery } from '@/lib/hooks';
import { Alert, Button, Card, TextArea, TextField } from './ui';

/** Dung chung: chuyen gia tu sua ho so (PATCH /experts/me) va admin sua ho so (PATCH /admin/experts/:id). */
export function ExpertProfileForm({
  expert,
  endpoint,
  withActive,
  onSaved,
}: {
  expert: PublicExpert & { active?: boolean };
  endpoint: string;
  withActive?: boolean;
  onSaved?: () => void;
}) {
  const specs = useQuery<{ specialties: { slug: string; name: string }[] }>('/specialties');
  const [chosen, setChosen] = useState<string[]>(expert.specialties.map((s) => s.slug));
  const [modes, setModes] = useState<string[]>(expert.modes);
  const [active, setActive] = useState(expert.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const fee = String(f.get('feeVnd') ?? '').trim();
    setBusy(true);
    setError(null);
    setFields({});
    setSaved(false);
    try {
      await api(endpoint, {
        method: 'PATCH',
        body: {
          headline: String(f.get('headline')),
          bio: String(f.get('bio')),
          credentials: String(f.get('credentials')),
          yearsExperience: Number(f.get('yearsExperience') || 0),
          sessionMinutes: Number(f.get('sessionMinutes') || 50),
          feeVnd: fee ? Number(fee) : null,
          modes,
          specialtySlugs: chosen,
          ...(withActive ? { active } : {}),
        },
      });
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Card className="space-y-4">
        <TextField label="Chức danh / giới thiệu ngắn" name="headline" defaultValue={expert.headline} maxLength={160} error={fields.headline} />
        <TextArea label="Giới thiệu" name="bio" defaultValue={expert.bio} maxLength={4000} rows={6} error={fields.bio} />
        <TextArea label="Học vấn & chứng chỉ" name="credentials" defaultValue={expert.credentials} maxLength={1000} error={fields.credentials} />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Số năm kinh nghiệm" name="yearsExperience" type="number" min={0} max={70} defaultValue={expert.yearsExperience} error={fields.yearsExperience} />
          <TextField label="Phút mỗi buổi" name="sessionMinutes" type="number" min={15} max={180} defaultValue={expert.sessionMinutes} error={fields.sessionMinutes} />
          <TextField label="Chi phí (VND)" name="feeVnd" type="number" min={0} defaultValue={expert.feeVnd ?? ''} error={fields.feeVnd} />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Hình thức</legend>
          <div className="flex flex-wrap gap-3">
            {[
              ['online', 'Trực tuyến'],
              ['in_person', 'Trực tiếp'],
            ].map(([v, l]) => (
              <label key={v} className="flex min-h-11 items-center gap-2 rounded-2xl border border-line px-4">
                <input type="checkbox" className="size-4 accent-brand-600" checked={modes.includes(v!)} onChange={() => setModes((m) => toggle(m, v!))} />
                {l}
              </label>
            ))}
          </div>
          {fields.modes && <p className="mt-1 text-sm text-danger-600">{fields.modes}</p>}
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Lĩnh vực chuyên môn</legend>
          <div className="flex flex-wrap gap-2">
            {specs.data?.specialties.map((s) => (
              <label key={s.slug} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm ${chosen.includes(s.slug) ? 'border-brand-600 bg-brand-50' : 'border-line'}`}>
                <input type="checkbox" className="size-4 accent-brand-600" checked={chosen.includes(s.slug)} onChange={() => setChosen((c) => toggle(c, s.slug))} />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
        {withActive && (
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-4 accent-brand-600" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Hiển thị công khai và nhận ca mới
          </label>
        )}
      </Card>
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="ok">Đã lưu.</Alert>}
      <Button type="submit" loading={busy}>
        Lưu hồ sơ
      </Button>
    </form>
  );
}
