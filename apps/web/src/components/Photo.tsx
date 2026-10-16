import Image from 'next/image';
import type { ReactNode } from 'react';

/** Mười ảnh dùng chung toàn site (xem public/images/CREDITS.md). Chỉ đổi tên/ghi chú ở đây, không rải đường dẫn trong trang. */
export const PHOTOS = {
  tuVan: { src: '/images/tu-van.jpg', alt: 'Chuyên gia ghi chép khi lắng nghe người đang trò chuyện', position: '55% 60%' },
  troChuyen: { src: '/images/tro-chuyen.jpg', alt: 'Chuyên gia tâm lý trò chuyện với thân chủ trong căn phòng nhiều ánh sáng', position: '40% 50%' },
  khongGian: { src: '/images/khong-gian.jpg', alt: 'Góc phòng tư vấn yên tĩnh với cây xanh, ghế sofa và đèn đứng', position: '50% 60%' },
  loAu: { src: '/images/lo-au.jpg', alt: 'Một người ôm đầu căng thẳng, chuyên gia ngồi cạnh ghi chép', position: '50% 40%' },
  langNghe: { src: '/images/lang-nghe.jpg', alt: 'Một người ngồi co chân bên cửa sổ có rèm trắng', position: '40% 50%' },
  giacNgu: { src: '/images/giac-ngu.jpg', alt: 'Người phụ nữ ngủ yên trên gối trắng', position: '60% 40%' },
  traSelfCare: { src: '/images/tra-self-care.jpg', alt: 'Tách trà thảo mộc đặt trên khay gỗ', position: '50% 50%' },
  banTay: { src: '/images/ban-tay.jpg', alt: 'Hai bàn tay nắm lấy nhau', position: '50% 45%' },
  chanhNiem: { src: '/images/chanh-niem.jpg', alt: 'Người ngồi thiền giữa rừng, nắng xuyên qua tán lá', position: '55% 50%', deep: true },
  coiRe: { src: '/images/coi-re.jpg', alt: 'Gốc cây cổ thụ với bộ rễ lớn, ánh nắng xuyên qua tán lá', position: '50% 60%', deep: true },
} as const;

export type PhotoName = keyof typeof PHOTOS;

/** Ảnh theo slug bài viết có sẵn; bài khác (hoặc bài có ảnh bìa riêng) không dùng bảng này. */
export const ARTICLE_PHOTOS: Record<string, PhotoName> = {
  'nhan-biet-dau-hieu-lo-au': 'loAu',
  'thoi-quen-giup-ngu-ngon-hon': 'giacNgu',
  'khi-nao-nen-gap-chuyen-gia-tam-ly': 'traSelfCare',
};

interface PhotoProps {
  name: PhotoName;
  /** Lớp kích thước/bo góc, ví dụ `aspect-[4/3] rounded-3xl`. Thêm `absolute inset-0` để làm nền. */
  className?: string;
  sizes: string;
  /** Ảnh đầu trang: tải ngay, không lazy. */
  eager?: boolean;
  /** Ghi đè vùng cắt (object-position). */
  position?: string;
  children?: ReactNode;
}

/** Ảnh có bộ lọc ấm chung (.photo trong globals.css). Cha phải có chiều cao (aspect-ratio hoặc kích thước cố định). */
export function Photo({ name, className = '', sizes, eager, position, children }: PhotoProps) {
  const p: { src: string; alt: string; position: string; deep?: boolean } = PHOTOS[name];
  const positioned = /\babsolute\b|\bfixed\b|\bsticky\b/.test(className) ? '' : 'relative';
  return (
    <div className={`photo ${positioned} ${className}`} data-grade={p.deep ? 'deep' : undefined}>
      <Image
        src={p.src}
        alt={p.alt}
        fill
        sizes={sizes}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        className="object-cover"
        style={{ objectPosition: position ?? p.position }}
      />
      {children}
    </div>
  );
}
