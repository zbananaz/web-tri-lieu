'use client';

import { AccountInfo } from '@/components/AccountInfo';
import { ChangePassword } from '@/components/ChangePassword';
import { PageTitle } from '@/components/ui';

export default function AdminAccountPage() {
  return (
    <>
      <PageTitle title="Tài khoản của tôi" />
      <div className="space-y-6">
        <AccountInfo />
        <ChangePassword />
      </div>
    </>
  );
}
