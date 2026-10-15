import { computeSlots, vnDate, vnMidnightUtc, windowsOverlap } from './slots.js';

// 2026-10-15 là thứ Năm (weekday = 4). 03:00 UTC = 10:00 giờ Việt Nam.
const NOW = new Date('2026-10-15T03:00:00Z');
const base = { sessionMinutes: 60, busy: [], now: NOW, days: 3, minLeadMinutes: 120 };

describe('computeSlots', () => {
  it('quy doi gio Viet Nam sang UTC chinh xac', () => {
    expect(vnDate(new Date('2026-10-14T20:00:00Z'))).toMatchObject({ y: 2026, m: 9, d: 15, weekday: 4 });
    expect(new Date(vnMidnightUtc(2026, 9, 15)).toISOString()).toBe('2026-10-14T17:00:00.000Z');
  });

  it('tao dung cac khung gio trong cua so, doi sang UTC', () => {
    // Thu Sau (5) 09:00-11:00 gio VN => 02:00 va 03:00 UTC ngay 16/10
    const slots = computeSlots({ ...base, windows: [{ weekday: 5, startMinute: 540, endMinute: 660 }] });
    expect(slots.map((s) => s.toISOString())).toEqual(['2026-10-16T02:00:00.000Z', '2026-10-16T03:00:00.000Z']);
  });

  it('bo cac khung gio da qua hoac qua sat gio hien tai', () => {
    // Hom nay thu Nam 10:00 VN. Cua so 09:00-14:00; thoi gian toi thieu 2 tieng => som nhat 12:00 VN.
    const slots = computeSlots({ ...base, windows: [{ weekday: 4, startMinute: 540, endMinute: 840 }] });
    expect(slots.map((s) => s.toISOString())).toEqual(['2026-10-15T05:00:00.000Z', '2026-10-15T06:00:00.000Z']);
  });

  it('loai khung gio bi lich hen khac chiem, ke ca chong len mot phan', () => {
    const windows = [{ weekday: 5, startMinute: 540, endMinute: 780 }]; // 09:00-13:00 VN
    const busy = [{ start: new Date('2026-10-16T02:30:00Z'), end: new Date('2026-10-16T03:30:00Z') }]; // 09:30-10:30 VN
    const slots = computeSlots({ ...base, windows, busy });
    // 09:00-10:00 va 10:00-11:00 deu chong len lich ban; con 11:00 va 12:00.
    expect(slots.map((s) => s.toISOString())).toEqual(['2026-10-16T04:00:00.000Z', '2026-10-16T05:00:00.000Z']);
  });

  it('khong tao khung gio khi cua so ngan hon mot buoi', () => {
    expect(computeSlots({ ...base, windows: [{ weekday: 5, startMinute: 540, endMinute: 580 }] })).toEqual([]);
  });

  it('gioi han theo so ngay', () => {
    const windows = [{ weekday: 1, startMinute: 540, endMinute: 600 }]; // thu Hai, ngoai 3 ngay toi
    expect(computeSlots({ ...base, windows })).toEqual([]);
    expect(computeSlots({ ...base, windows, days: 7 })).toHaveLength(1);
  });
});

describe('windowsOverlap', () => {
  it('phat hien chong len nhau cung thu', () => {
    expect(windowsOverlap([{ weekday: 1, startMinute: 540, endMinute: 660 }, { weekday: 1, startMinute: 600, endMinute: 720 }])).toBe(true);
    expect(windowsOverlap([{ weekday: 1, startMinute: 540, endMinute: 660 }, { weekday: 1, startMinute: 660, endMinute: 720 }])).toBe(false);
    expect(windowsOverlap([{ weekday: 1, startMinute: 540, endMinute: 660 }, { weekday: 2, startMinute: 540, endMinute: 660 }])).toBe(false);
  });
});
