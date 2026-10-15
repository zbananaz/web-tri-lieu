'use client';

import type { QuestionOption, QuestionType } from '@wtl/shared';
import { useState } from 'react';
import { Alert, Badge, Button, Card, PageTitle, QueryState, SelectField, TextArea, TextField } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useQuery } from '@/lib/hooks';

interface Q {
  id: string;
  position: number;
  prompt: string;
  helpText: string | null;
  type: QuestionType;
  options: QuestionOption[];
  required: boolean;
  active: boolean;
}

const BLANK: Omit<Q, 'id'> = { position: 0, prompt: '', helpText: '', type: 'single', options: [], required: true, active: true };
const TYPE_LABEL: Record<QuestionType, string> = { single: 'Chọn một', multi: 'Chọn nhiều', text: 'Văn bản' };

function Editor({ initial, id, nextPosition, onSaved, onCancel }: { initial: Omit<Q, 'id'>; id?: string; nextPosition: number; onSaved: () => void; onCancel: () => void }) {
  const [q, setQ] = useState({ ...initial, position: id ? initial.position : nextPosition });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOpt = (i: number, patch: Partial<QuestionOption>) => setQ((cur) => ({ ...cur, options: cur.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...q,
        helpText: q.helpText?.trim() || null,
        options: q.type === 'text' ? [] : q.options.map((o) => ({
          value: o.value.trim(),
          label: o.label.trim(),
          ...(o.risk ? { risk: o.risk } : {}),
          ...(o.specialties?.length ? { specialties: o.specialties } : {}),
        })),
      };
      await api(id ? `/admin/screening-questions/${id}` : '/admin/screening-questions', { method: id ? 'PUT' : 'POST', body });
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <TextArea label="Nội dung câu hỏi" rows={2} value={q.prompt} onChange={(e) => setQ({ ...q, prompt: e.target.value })} />
      <TextField label="Gợi ý dưới câu hỏi (không bắt buộc)" value={q.helpText ?? ''} onChange={(e) => setQ({ ...q, helpText: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Loại" value={q.type} onChange={(e) => setQ({ ...q, type: e.target.value as QuestionType })}>
          {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </SelectField>
        <TextField label="Thứ tự" type="number" min={0} value={q.position} onChange={(e) => setQ({ ...q, position: Number(e.target.value) })} />
        <div className="flex flex-col justify-end gap-2">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-4 accent-brand-600" checked={q.required} onChange={(e) => setQ({ ...q, required: e.target.checked })} /> Bắt buộc
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-4 accent-brand-600" checked={q.active} onChange={(e) => setQ({ ...q, active: e.target.checked })} /> Đang hiển thị
          </label>
        </div>
      </div>
      {q.type !== 'text' && (
        <fieldset className="space-y-3">
          <legend className="font-semibold">Các lựa chọn</legend>
          <p className="text-sm text-muted">
            “Nguy cơ” và “lĩnh vực” chỉ quản trị viên thấy; khách không nhìn thấy để không bị định hướng câu trả lời.
          </p>
          {q.options.map((o, i) => (
            <div key={i} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
              <TextField label="Nhãn hiển thị" value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} />
              <TextField label="Mã giá trị (không dấu, duy nhất)" value={o.value} onChange={(e) => setOpt(i, { value: e.target.value })} />
              <SelectField label="Nguy cơ" value={o.risk ?? ''} onChange={(e) => setOpt(i, { risk: (e.target.value || undefined) as QuestionOption['risk'] })}>
                <option value="">Không</option>
                <option value="elevated">Cần lưu ý</option>
                <option value="urgent">Khẩn cấp</option>
              </SelectField>
              <TextField
                label="Lĩnh vực gợi ý (slug, cách nhau bằng dấu phẩy)"
                value={(o.specialties ?? []).join(', ')}
                onChange={(e) => setOpt(i, { specialties: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              />
              <div className="sm:col-span-2">
                <Button variant="ghost" onClick={() => setQ({ ...q, options: q.options.filter((_, idx) => idx !== i) })}>
                  Xóa lựa chọn
                </Button>
              </div>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setQ({ ...q, options: [...q.options, { value: '', label: '' }] })}>
            + Thêm lựa chọn
          </Button>
        </fieldset>
      )}
      <div className="flex gap-2">
        <Button onClick={save} loading={busy}>
          Lưu câu hỏi
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </div>
  );
}

export default function QuestionsPage() {
  const q = useQuery<{ questions: Q[] }>('/admin/screening-questions');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const list = q.data?.questions ?? [];
  const done = () => {
    setEditing(null);
    void q.reload();
  };

  return (
    <>
      <PageTitle title="Câu hỏi sàng lọc">
        <Button onClick={() => setEditing('new')}>+ Thêm câu hỏi</Button>
      </PageTitle>
      <Alert tone="warm">Nội dung câu hỏi và mức nguy cơ cần được chuyên gia lâm sàng của trung tâm thẩm định. Bộ câu hỏi mặc định chỉ là mẫu.</Alert>
      <div className="mt-4 space-y-3">
        <QueryState loading={q.loading} error={q.error} />
        {editing === 'new' && (
          <Card>
            <Editor initial={BLANK} nextPosition={(list.at(-1)?.position ?? 0) + 1} onSaved={done} onCancel={() => setEditing(null)} />
          </Card>
        )}
        {list.map((item) => (
          <Card key={item.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {item.position}. {item.prompt}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge>{TYPE_LABEL[item.type]}</Badge>
                  {item.required && <Badge tone="brand">Bắt buộc</Badge>}
                  {!item.active && <Badge tone="warm">Đang ẩn</Badge>}
                  {item.options.some((o) => o.risk) && <Badge tone="danger">Có đáp án nguy cơ</Badge>}
                </div>
              </div>
              <Button variant="secondary" onClick={() => setEditing(editing === item.id ? null : item.id)}>
                {editing === item.id ? 'Đóng' : 'Chỉnh sửa'}
              </Button>
            </div>
            {editing === item.id && <Editor initial={item} id={item.id} nextPosition={item.position} onSaved={done} onCancel={() => setEditing(null)} />}
          </Card>
        ))}
      </div>
    </>
  );
}
