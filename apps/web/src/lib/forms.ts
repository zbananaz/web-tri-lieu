import { ApiError } from './api';

/** Chuyen loi kiem tra tu API thanh map truong -> thong diep. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError)) return {};
  return Object.fromEntries(e.issues.map((i) => [i.path, i.message]));
}

/** Chi chap nhan duong dan noi bo de tranh open redirect. */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) return next;
  return fallback;
}
