// Bieu tuong la/mam non: hinh don gian, net mem, dung lam logo va anh bia thay the.
export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M12 21c0-5.5 0-9 0-12" />
      <path d="M12 13c-4.5 0-7-2.6-7-7 4.4 0 7 2.5 7 7Z" />
      <path d="M12 16.5c0-3.6 2.4-6 6-6 0 3.8-2.4 6-6 6Z" />
    </svg>
  );
}
