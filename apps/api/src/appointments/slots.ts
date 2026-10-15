/** Viet Nam: UTC+7 quanh nam, khong co gio mua he. Gio ranh luu theo gio dia phuong, lich hen luu UTC. */
export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const MINUTE = 60_000;

/** Dat lich phai truoc it nhat ngan nay phut (dung chung cho dat lich va goi y gio trong gan nhat). */
export const MIN_LEAD_MINUTES = 120;

export interface AvailabilityWindow {
  weekday: number; // 0 = Chu nhat
  startMinute: number;
  endMinute: number;
}

export interface BusyRange {
  start: Date;
  end: Date;
}

export interface SlotOptions {
  windows: AvailabilityWindow[];
  sessionMinutes: number;
  busy: BusyRange[];
  now: Date;
  days: number;
  minLeadMinutes: number;
}

/** Ngay (nam, thang, ngay, thu) theo gio Viet Nam cua mot thoi diem UTC. */
export function vnDate(at: Date) {
  const t = new Date(at.getTime() + VN_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), weekday: t.getUTCDay() };
}

/** Thoi diem UTC cua 00:00 gio Viet Nam trong ngay y-m-d. */
export function vnMidnightUtc(y: number, m: number, d: number): number {
  return Date.UTC(y, m, d) - VN_OFFSET_MS;
}

/** Cac gio bat dau buoi hen con trong trong `days` ngay toi. Tra ve theo thu tu thoi gian. */
export function computeSlots(opts: SlotOptions): Date[] {
  const { windows, sessionMinutes, busy, now, days, minLeadMinutes } = opts;
  const today = vnDate(now);
  const earliest = now.getTime() + minLeadMinutes * MINUTE;
  const slots: Date[] = [];

  for (let i = 0; i < days; i++) {
    const base = vnMidnightUtc(today.y, today.m, today.d + i);
    const weekday = (today.weekday + i) % 7;
    for (const w of windows.filter((x) => x.weekday === weekday)) {
      for (let s = w.startMinute; s + sessionMinutes <= w.endMinute; s += sessionMinutes) {
        const start = base + s * MINUTE;
        const end = start + sessionMinutes * MINUTE;
        if (start < earliest) continue;
        if (busy.some((b) => b.start.getTime() < end && b.end.getTime() > start)) continue;
        slots.push(new Date(start));
      }
    }
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}

/** Hai khung gio cung thu co chong len nhau khong. */
export function windowsOverlap(list: AvailabilityWindow[]): boolean {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      if (a.weekday === b.weekday && a.startMinute < b.endMinute && b.startMinute < a.endMinute) return true;
    }
  }
  return false;
}
