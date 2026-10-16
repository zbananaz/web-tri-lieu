import type { ReactNode } from 'react';
import { Photo, type PhotoName } from './Photo';

/** Banner đầu trang: ảnh nền ấm, lớp phủ nâu đậm để chữ trắng luôn đủ tương phản. */
export function PageBanner({
  photo,
  eyebrow,
  title,
  position,
  children,
}: {
  photo: PhotoName;
  eyebrow?: string;
  title: string;
  position?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-cocoa text-white shadow-soft sm:rounded-[2.5rem]">
      <Photo name={photo} position={position} sizes="(min-width: 1152px) 1100px, 100vw" className="absolute inset-0 -z-10" eager />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-cocoa/90 via-cocoa/70 to-cocoa/20 max-sm:from-cocoa/80 max-sm:via-cocoa/70 max-sm:to-cocoa/50" />
      <div className="max-w-xl px-6 py-12 sm:px-12 sm:py-16">
        {eyebrow && <p className="text-sm font-medium tracking-wide text-brand-100">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl text-white sm:text-4xl">{title}</h1>
        {children && <div className="mt-3 text-base text-white/85 sm:text-lg">{children}</div>}
      </div>
    </section>
  );
}
