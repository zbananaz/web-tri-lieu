'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useState } from 'react';
import { Alert, Button, Card, TextField } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { HOME_BY_ROLE, useAuth } from '@/lib/auth';
import { fieldErrors, safeNext } from '@/lib/forms';

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const phone = String(f.get('phone') ?? '').trim();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const user = await register({
        fullName: String(f.get('fullName')),
        email: String(f.get('email')),
        password: String(f.get('password')),
        ...(phone ? { phone } : {}),
      });
      router.replace(safeNext(next, HOME_BY_ROLE[user.role]));
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Tạo tài khoản</h1>
      <p className="mt-1 text-sm text-muted">Tài khoản giúp bạn theo dõi hồ sơ, đặt lịch và trò chuyện với chuyên gia.</p>
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <TextField label="Họ và tên" name="fullName" autoComplete="name" required error={fields.fullName} />
        <TextField label="Email" name="email" type="email" autoComplete="email" required error={fields.email} />
        <TextField label="Số điện thoại (không bắt buộc)" name="phone" type="tel" autoComplete="tel" error={fields.phone} />
        <TextField
          label="Mật khẩu"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          hint="Tối thiểu 8 ký tự, gồm cả chữ và số."
          error={fields.password}
        />
        <Button type="submit" loading={busy} className="w-full">
          Đăng ký
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        Đã có tài khoản?{' '}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-semibold text-brand-700 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
