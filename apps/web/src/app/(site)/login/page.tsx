'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useState } from 'react';
import { Alert, Button, Card, TextField } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { HOME_BY_ROLE, useAuth } from '@/lib/auth';
import { safeNext } from '@/lib/forms';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const user = await login({ email: String(form.get('email')), password: String(form.get('password')) });
      router.replace(safeNext(next, HOME_BY_ROLE[user.role]));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Đăng nhập</h1>
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField label="Mật khẩu" name="password" type="password" autoComplete="current-password" required />
        <Button type="submit" loading={busy} className="w-full">
          Đăng nhập
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        Chưa có tài khoản?{' '}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'} className="font-semibold text-brand-700 hover:underline">
          Đăng ký
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
