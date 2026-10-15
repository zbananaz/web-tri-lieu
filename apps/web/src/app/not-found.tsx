import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="text-xl font-semibold">Không tìm thấy trang</h1>
      <p className="text-muted">Trang bạn tìm không tồn tại hoặc bạn không có quyền xem.</p>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">
        Về trang chủ
      </Link>
    </main>
  );
}
