'use client';

import Link from 'next/link';
import { type FormEvent, useState, useSyncExternalStore } from 'react';
import { Alert, Button, Card, TextField } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fieldErrors } from '@/lib/forms';

// Token nam o fragment (#token=...) nen khong vao log may chu; doc mot lan roi xoa khoi thanh dia chi.
let captured = '';
function readToken(): string {
  if (!captured && typeof window !== 'undefined') {
    const m = /token=([\w-]+)/.exec(window.location.hash);
    if (m) {
      captured = m[1]!;
      window.history.replaceState(null, '', window.location.pathname);
    }
  }
  return captured;
}
const subscribe = () => () => {};

export default function ResetPasswordPage() {
  const token = useSyncExternalStore(subscribe, readToken, () => '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newPassword = String(f.get('newPassword') ?? '');
    setError(null);
    setFields({});
    if (newPassword !== String(f.get('confirm') ?? '')) {
      setFields({ confirm: 'Mật khẩu nhập lại không khớp' });
      return;
    }
    setBusy(true);
    try {
      await api('/auth/reset-password', { body: { token, newPassword } });
      captured = '';
      setDone(true);
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Đặt lại mật khẩu</h1>
      {done ? (
        <div className="mt-5 space-y-4">
          <Alert tone="ok">Đã đặt mật khẩu mới. Các thiết bị đang đăng nhập đã bị đăng xuất.</Alert>
          <Link href="/login" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
            Đăng nhập
          </Link>
        </div>
      ) : !token ? (
        <div className="mt-5 space-y-4">
          <Alert>Liên kết không hợp lệ. Hãy mở đúng liên kết trong email, hoặc yêu cầu liên kết mới.</Alert>
          <Link href="/forgot-password" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
            Yêu cầu liên kết mới
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <TextField
            label="Mật khẩu mới"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            hint="Tối thiểu 8 ký tự, gồm cả chữ và số."
            error={fields.newPassword}
          />
          <TextField label="Nhập lại mật khẩu mới" name="confirm" type="password" autoComplete="new-password" required error={fields.confirm} />
          <Button type="submit" loading={busy} className="w-full">
            Đặt mật khẩu mới
          </Button>
        </form>
      )}
    </Card>
  );
}
