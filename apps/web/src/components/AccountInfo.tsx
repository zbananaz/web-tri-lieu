'use client';

import { useAuth } from '@/lib/auth';
import { Card } from './ui';

const ROLE_LABEL = { client: 'Khách hàng', expert: 'Chuyên gia', admin: 'Quản trị viên' } as const;

export function AccountInfo() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Card className="max-w-md">
      <h2 className="text-lg font-bold">Thông tin</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-muted">Họ tên</dt>
          <dd className="font-medium">{user.fullName}</dd>
        </div>
        <div>
          <dt className="text-muted">Email</dt>
          <dd className="font-medium">{user.email}</dd>
        </div>
        <div>
          <dt className="text-muted">Vai trò</dt>
          <dd className="font-medium">{ROLE_LABEL[user.role]}</dd>
        </div>
      </dl>
    </Card>
  );
}
