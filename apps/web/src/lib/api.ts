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

export const errorMessage = (e: unknown): string => (e instanceof ApiError ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.');
