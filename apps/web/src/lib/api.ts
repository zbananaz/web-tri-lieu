/** Loi tu API: giu status va thong diep tieng Viet de hien cho nguoi dung. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

type Json = Record<string, unknown> | unknown[];

/** Goi tu trinh duyet: luon qua /api/* cung origin (cookie phien httpOnly tu dong duoc gui). */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: Json } = {}): Promise<T> {
  const method = opts.method ?? (opts.body ? 'POST' : 'GET');
  const res = await fetch(`/api${path}`, {
    method,
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      res.status === 429
        ? 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.'
        : typeof data?.message === 'string'
          ? data.message
          : 'Có lỗi xảy ra, vui lòng thử lại.';
    throw new ApiError(res.status, message, Array.isArray(data?.issues) ? data.issues : []);
  }
  return data as T;
}

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Tai anh (quan tri) len may chu; tra ve duong dan /api/uploads/... de dung lam anh bia hoac chen vao bai. */
export async function uploadImage(file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new ApiError(415, 'Chỉ nhận ảnh PNG, JPEG hoặc WebP');
  if (file.size > MAX_IMAGE_BYTES) throw new ApiError(413, 'Ảnh quá lớn (tối đa 3 MB)');
  const res = await fetch('/api/admin/uploads', {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || typeof data?.url !== 'string') {
    throw new ApiError(res.status, typeof data?.message === 'string' ? data.message : 'Không tải được ảnh, vui lòng thử lại.');
  }
  return data.url;
}

export const errorMessage = (e: unknown): string => (e instanceof ApiError ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.');
