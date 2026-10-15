import 'server-only';

const BASE = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';

/** Goi API tu may chu Next (trang cong khai cho SEO). Chi dung cho du lieu cong khai, khong kem cookie. */
export async function serverApi<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/api${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // API tam thoi khong ket noi duoc: trang van render, khong sap
  }
}
