import { Dashboard } from '@/components/Dashboard';

export default function MeLayout({ children }: LayoutProps<'/me'>) {
  return (
    <Dashboard
      role="client"
      title="Khu của bạn"
      nav={[
        { href: '/me', label: 'Hồ sơ của tôi', exact: true },
        { href: '/me/appointments', label: 'Lịch hẹn' },
        { href: '/me/account', label: 'Tài khoản' },
      ]}
    >
      {children}
    </Dashboard>
  );
}
