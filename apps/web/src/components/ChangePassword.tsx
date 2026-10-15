'use client';

import { type FormEvent, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { fieldErrors } from '@/lib/forms';
import { Alert, Button, Card, TextField } from './ui';

export function ChangePassword() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError(null);
    setFields({});
    setDone(false);
    try {
      await api('/auth/change-password', { body: { currentPassword: String(f.get('currentPassword')), newPassword: String(f.get('newPassword')) } });
      form.reset();
      setDone(true);
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-md">
      <h2 className="text-lg font-bold">Đổi mật khẩu</h2>
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        {done && <Alert tone="ok">Đã đổi mật khẩu. Các thiết bị khác sẽ phải đăng nhập lại.</Alert>}
        <TextField label="Mật khẩu hiện tại" name="currentPassword" type="password" autoComplete="current-password" required />
        <TextField label="Mật khẩu mới" name="newPassword" type="password" autoComplete="new-password" required hint="Tối thiểu 8 ký tự, gồm cả chữ và số." error={fields.newPassword} />
        <Button type="submit" loading={busy}>
          Đổi mật khẩu
        </Button>
      </form>
    </Card>
  );
}
