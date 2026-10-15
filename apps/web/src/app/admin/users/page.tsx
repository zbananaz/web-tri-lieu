'use client';

import type { Role } from '@wtl/shared';
import { useState } from 'react';
import { Alert, Badge, Button, PageTitle, QueryState } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { useQuery } from '@/lib/hooks';

interface U {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  status: 'active' | 'disabled';
  createdAt: string;
}
const ROLE_LABEL: Record<Role, string> = { client: 'Khách hàng', expert: 'Chuyên gia', admin: 'Quản trị' };

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const q = useQuery<{ users: U[] }>('/admin/users');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);

  const toggle = async (u: U) => {
    const to = u.status === 'active' ? 'disabled' : 'active';
    if (to === 'disabled' && !window.confirm(`Khóa tài khoản ${u.email}? Họ sẽ bị đăng xuất ngay.`)) return;
    setBusy(u.id);
    setError(null);
    try {
      await api(`/admin/users/${u.id}/status`, { method: 'PATCH', body: { status: to } });
      await q.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const resetPassword = async (u: U) => {
    if (!window.confirm(`Cấp mật khẩu tạm cho ${u.email}? Họ sẽ bị đăng xuất khỏi mọi thiết bị và phải đổi mật khẩu khi đăng nhập lại.`)) return;
    setBusy(u.id);
    setError(null);
    setTemp(null);
    try {
      const r = await api<{ temporaryPassword: string }>(`/admin/users/${u.id}/reset-password`, { method: 'POST', body: {} });
      setTemp({ email: u.email, password: r.temporaryPassword });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageTitle title="Tài khoản người dùng" />
      <p className="mb-4 text-sm text-muted">Mỗi lần xem danh sách này đều được ghi nhật ký.</p>
      <QueryState loading={q.loading} error={q.error} />
      {error && <Alert>{error}</Alert>}
      {temp && (
        <Alert tone="ok">
          <p className="font-semibold">Mật khẩu tạm cho {temp.email} (chỉ hiện một lần, chưa được lưu ở đâu khác):</p>
          <p className="my-2 select-all font-mono text-lg tracking-wide" data-testid="temp-password">
            {temp.password}
          </p>
          <p className="text-sm">Hãy gửi cho người dùng qua kênh riêng (điện thoại trực tiếp). Họ sẽ phải đặt mật khẩu mới ngay khi đăng nhập.</p>
          <Button variant="ghost" onClick={() => setTemp(null)}>
            Đã chuyển, ẩn đi
          </Button>
        </Alert>
      )}
      {q.data && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line bg-brand-50 text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Họ tên</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Vai trò</th>
                <th className="px-4 py-3 font-semibold">Tạo ngày</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {q.data.users.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium">{u.fullName}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                  <td className="px-4 py-3">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={u.status === 'active' ? 'ok' : 'danger'}>{u.status === 'active' ? 'Hoạt động' : 'Đã khóa'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== me?.id && (
                      <div className="flex justify-end gap-1">
                        {u.role !== 'admin' && (
                          <Button variant="ghost" loading={busy === u.id} onClick={() => resetPassword(u)} aria-label={`Cấp mật khẩu tạm cho ${u.email}`}>
                            Cấp mật khẩu tạm
                          </Button>
                        )}
                        <Button variant="ghost" loading={busy === u.id} onClick={() => toggle(u)}>
                          {u.status === 'active' ? 'Khóa' : 'Mở khóa'}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
