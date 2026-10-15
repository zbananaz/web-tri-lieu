'use client';

import { useAuth } from '@/lib/auth';
import { ChangePassword } from './ChangePassword';
import { Alert, Button } from './ui';

/** Hien thay moi trang khi tai khoan dang dung mat khau tam do quan tri cap: phai doi roi moi dung tiep (may chu cung chan). */
export function ForcedPasswordChange() {
  const { logout } = useAuth();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <Alert tone="brand">Bạn đang dùng mật khẩu tạm do quản trị viên cấp. Hãy đặt mật khẩu mới của riêng bạn để tiếp tục.</Alert>
      <ChangePassword />
      <Button variant="ghost" onClick={() => void logout()}>
        Đăng xuất
      </Button>
    </main>
  );
}
