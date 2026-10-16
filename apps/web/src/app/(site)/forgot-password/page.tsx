'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { Alert, Button, Card, TextField } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '');
    setBusy(true);
    setError(null);
    try {
      await api('/auth/forgot-password', { body: { email } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Quên mật khẩu</h1>
      {sent ? (
        <div className="mt-5 space-y-4">
          <Alert tone="ok">
            Nếu email này đã đăng ký, chúng tôi vừa gửi liên kết đặt lại mật khẩu (có hiệu lực 45 phút). Hãy kiểm tra cả thư rác.
          </Alert>
          <Link href="/login" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
            Quay lại đăng nhập
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <p className="text-sm text-muted">Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết để đặt mật khẩu mới.</p>
          {error && <Alert>{error}</Alert>}
          <TextField label="Email" name="email" type="email" autoComplete="email" required />
          <Button type="submit" loading={busy} className="w-full">
            Gửi liên kết
          </Button>
          <p className="text-center text-sm text-muted">
            Không nhận được thư? Liên hệ trung tâm để được cấp mật khẩu tạm.
          </p>
        </form>
      )}
    </Card>
  );
}
