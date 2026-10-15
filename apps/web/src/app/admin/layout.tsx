import { Dashboard } from '@/components/Dashboard';

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Dashboard
      role="admin"
      title="Quản trị"
      nav={[
        { href: '/admin', label: 'Hàng chờ hồ sơ', exact: true },
        { href: '/admin/appointments', label: 'Lịch hẹn' },
        { href: '/admin/reviews', label: 'Đánh giá' },
        { href: '/admin/experts', label: 'Chuyên gia' },
        { href: '/admin/questions', label: 'Câu hỏi sàng lọc' },
        { href: '/admin/articles', label: 'Bài viết' },
        { href: '/admin/users', label: 'Tài khoản' },
        { href: '/admin/audit', label: 'Nhật ký' },
        { href: '/admin/account', label: 'Của tôi' },
      ]}
    >
      {children}
    </Dashboard>
  );
}
