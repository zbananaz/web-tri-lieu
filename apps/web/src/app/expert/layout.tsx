import { Dashboard } from '@/components/Dashboard';

export default function ExpertLayout({ children }: LayoutProps<'/expert'>) {
  return (
    <Dashboard
      role="expert"
      title="Khu chuyên gia"
      nav={[
        { href: '/expert', label: 'Ca của tôi', exact: true },
        { href: '/expert/appointments', label: 'Lịch hẹn' },
        { href: '/expert/availability', label: 'Giờ rảnh' },
        { href: '/expert/profile', label: 'Hồ sơ' },
        { href: '/expert/account', label: 'Tài khoản' },
      ]}
    >
      {children}
    </Dashboard>
  );
}
