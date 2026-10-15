'use client';

import type { PublicExpert } from '@wtl/shared';
import { type FormEvent, useState } from 'react';
import { ExpertProfileForm } from '@/components/ExpertProfileForm';
import { Alert, Badge, Button, Card, PageTitle, QueryState, TextField } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fieldErrors } from '@/lib/forms';
import { useQuery } from '@/lib/hooks';

type Row = PublicExpert & { email: string; phone: string | null; active: boolean };

function CreateExpert({ onCreated }: { onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const phone = String(f.get('phone') ?? '').trim();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api('/admin/experts', {
        body: {
          fullName: String(f.get('fullName')),
          email: String(f.get('email')),
          password: String(f.get('password')),
          ...(phone ? { phone } : {}),
          profile: { headline: String(f.get('headline') ?? '') },
        },
      });
      form.reset();
      onCreated();
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-bold">Thêm chuyên gia</h2>
      <p className="text-sm text-muted">Tạo tài khoản với mật khẩu tạm; hãy yêu cầu chuyên gia đổi mật khẩu khi đăng nhập lần đầu.</p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
        {error && (
          <div className="sm:col-span-2">
            <Alert>{error}</Alert>
          </div>
        )}
        <TextField label="Họ và tên" name="fullName" required error={fields.fullName} />
        <TextField label="Email" name="email" type="email" required error={fields.email} />
        <TextField label="Mật khẩu tạm" name="password" type="password" autoComplete="new-password" required error={fields.password} />
        <TextField label="Số điện thoại" name="phone" type="tel" error={fields.phone} />
        <div className="sm:col-span-2">
          <TextField label="Chức danh" name="headline" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" loading={busy}>
            Tạo chuyên gia
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function AdminExpertsPage() {
  const q = useQuery<{ experts: Row[] }>('/admin/experts');
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <>
      <PageTitle title="Chuyên gia" />
      <div className="space-y-6">
        <CreateExpert onCreated={() => void q.reload()} />
        <QueryState loading={q.loading} error={q.error} />
        <ul className="space-y-3">
          {q.data?.experts.map((e) => (
            <li key={e.id}>
              <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{e.fullName}</p>
                    <p className="text-sm text-muted">
                      {e.email}
                      {e.phone ? ` · ${e.phone}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={e.active ? 'ok' : 'danger'}>{e.active ? 'Đang nhận ca' : 'Tạm ngưng'}</Badge>
                    <Button variant="secondary" onClick={() => setEditing(editing === e.id ? null : e.id)}>
                      {editing === e.id ? 'Đóng' : 'Chỉnh sửa'}
                    </Button>
                  </div>
                </div>
                {editing === e.id && <ExpertProfileForm expert={e} endpoint={`/admin/experts/${e.id}`} withActive onSaved={() => void q.reload()} />}
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
