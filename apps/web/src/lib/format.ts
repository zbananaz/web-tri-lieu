import type { AppointmentStatus, CaseStatus, RiskLevel } from '@wtl/shared';

const TZ = 'Asia/Ho_Chi_Minh';

export const formatDateTime = (iso: string | Date): string =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

export const formatDate = (iso: string | Date): string =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, dateStyle: 'long' }).format(new Date(iso));

export const formatTime = (iso: string | Date): string =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** Khoa ngay theo gio Viet Nam, dung de gom khung gio theo ngay. */
export const dayKey = (iso: string | Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

export const formatDayLabel = (iso: string | Date): string =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(iso));

export const formatVnd = (n: number | null | undefined): string =>
  n == null ? 'Liên hệ' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

export const minuteToTime = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const timeToMinute = (t: string): number => {
  const [h = '0', m = '0'] = t.split(':');
  return Number(h) * 60 + Number(m);
};

export const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
export const MODE_LABELS: Record<string, string> = { online: 'Trực tuyến', in_person: 'Trực tiếp', any: 'Linh hoạt' };

export const caseTone = (s: CaseStatus): 'neutral' | 'brand' | 'warm' | 'danger' | 'ok' =>
  ({ submitted: 'warm', approved: 'brand', rejected: 'danger', assigned: 'brand', contacted: 'brand', in_treatment: 'ok', closed: 'neutral' })[s] as never;

export const riskTone = (r: RiskLevel): 'neutral' | 'warm' | 'danger' => (r === 'urgent' ? 'danger' : r === 'elevated' ? 'warm' : 'neutral');

export const apptTone = (s: AppointmentStatus): 'neutral' | 'warm' | 'danger' | 'ok' =>
  ({ requested: 'warm', confirmed: 'ok', cancelled: 'danger', completed: 'neutral' })[s] as never;
