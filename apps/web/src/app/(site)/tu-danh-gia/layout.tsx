import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Tự đánh giá tâm trạng (PHQ-9, GAD-7)',
  description: 'Hai bảng câu hỏi tự đánh giá ngắn về trầm cảm và lo âu. Kết quả chỉ để tham khảo, không phải chẩn đoán.',
  alternates: { canonical: '/tu-danh-gia' },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
