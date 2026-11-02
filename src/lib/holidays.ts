/**
 * Vietnamese Public Holidays & Holiday Rate Helpers
 */

export interface HolidayInfo {
  isHoliday: boolean;
  name: string;
  defaultMultiplier: number;
}

// Fixed solar holidays in Vietnam (MM-DD)
export const SOLAR_HOLIDAYS: Record<string, { name: string; multiplier: number }> = {
  '01-01': { name: 'Tết Dương Lịch', multiplier: 3 },
  '04-30': { name: 'Giải phóng miền Nam (30/4)', multiplier: 3 },
  '05-01': { name: 'Quốc tế Lao động (1/5)', multiplier: 3 },
  '09-02': { name: 'Quốc khánh (2/9)', multiplier: 3 },
  '09-03': { name: 'Nghỉ Quốc khánh (3/9)', multiplier: 3 },
};

// Variable lunar holidays mapped to specific solar dates for recent & upcoming years
// Includes Giỗ Tổ Hùng Vương (10/3 Âm lịch) & Tết Nguyên Đán (29/30 tháng Chạp -> mùng 5 Tết)
export const LUNAR_HOLIDAYS_MAP: Record<string, { name: string; multiplier: number }> = {
  // 2024
  '2024-02-08': { name: 'Tết Nguyên Đán (29 Tết)', multiplier: 4 },
  '2024-02-09': { name: 'Tết Nguyên Đán (30 Tết)', multiplier: 4 },
  '2024-02-10': { name: 'Mùng 1 Tết Giáp Thìn', multiplier: 4 },
  '2024-02-11': { name: 'Mùng 2 Tết Giáp Thìn', multiplier: 4 },
  '2024-02-12': { name: 'Mùng 3 Tết Giáp Thìn', multiplier: 4 },
  '2024-02-13': { name: 'Mùng 4 Tết Giáp Thìn', multiplier: 4 },
  '2024-02-14': { name: 'Mùng 5 Tết Giáp Thìn', multiplier: 4 },
  '2024-04-18': { name: 'Giỗ Tổ Hùng Vương (10/3 ÂL)', multiplier: 3 },

  // 2025
  '2025-01-27': { name: 'Tết Nguyên Đán (28 Tết)', multiplier: 4 },
  '2025-01-28': { name: 'Tết Nguyên Đán (29 Tết)', multiplier: 4 },
  '2025-01-29': { name: 'Mùng 1 Tết Ất Tỵ', multiplier: 4 },
  '2025-01-30': { name: 'Mùng 2 Tết Ất Tỵ', multiplier: 4 },
  '2025-01-31': { name: 'Mùng 3 Tết Ất Tỵ', multiplier: 4 },
  '2025-02-01': { name: 'Mùng 4 Tết Ất Tỵ', multiplier: 4 },
  '2025-02-02': { name: 'Mùng 5 Tết Ất Tỵ', multiplier: 4 },
  '2025-04-07': { name: 'Giỗ Tổ Hùng Vương (10/3 ÂL)', multiplier: 3 },

  // 2026
  '2026-02-15': { name: 'Tết Nguyên Đán (28 Tết)', multiplier: 4 },
  '2026-02-16': { name: 'Tết Nguyên Đán (29 Tết)', multiplier: 4 },
  '2026-02-17': { name: 'Mùng 1 Tết Bính Ngọ', multiplier: 4 },
  '2026-02-18': { name: 'Mùng 2 Tết Bính Ngọ', multiplier: 4 },
  '2026-02-19': { name: 'Mùng 3 Tết Bính Ngọ', multiplier: 4 },
  '2026-02-20': { name: 'Mùng 4 Tết Bính Ngọ', multiplier: 4 },
  '2026-02-21': { name: 'Mùng 5 Tết Bính Ngọ', multiplier: 4 },
  '2026-04-26': { name: 'Giỗ Tổ Hùng Vương (10/3 ÂL)', multiplier: 3 },

  // 2027
  '2027-02-05': { name: 'Tết Nguyên Đán (29 Tết)', multiplier: 4 },
  '2027-02-06': { name: 'Mùng 1 Tết Đinh Mùi', multiplier: 4 },
  '2027-02-07': { name: 'Mùng 2 Tết Đinh Mùi', multiplier: 4 },
  '2027-02-08': { name: 'Mùng 3 Tết Đinh Mùi', multiplier: 4 },
  '2027-02-09': { name: 'Mùng 4 Tết Đinh Mùi', multiplier: 4 },
  '2027-02-10': { name: 'Mùng 5 Tết Đinh Mùi', multiplier: 4 },
  '2027-04-16': { name: 'Giỗ Tổ Hùng Vương (10/3 ÂL)', multiplier: 3 },
};

/**
 * Check if a date (YYYY-MM-DD) is a recognized Vietnamese public holiday
 */
export function getVietnameseHoliday(dateStr: string): HolidayInfo | null {
  if (!dateStr) return null;

  // 1. Check exact solar date in Lunar Holidays Map (Tet, Hung King)
  if (LUNAR_HOLIDAYS_MAP[dateStr]) {
    return {
      isHoliday: true,
      name: LUNAR_HOLIDAYS_MAP[dateStr].name,
      defaultMultiplier: LUNAR_HOLIDAYS_MAP[dateStr].multiplier,
    };
  }

  // 2. Check fixed solar holiday (e.g. 04-30, 05-01, 09-02, 01-01)
  const monthDay = dateStr.slice(5); // "MM-DD"
  if (SOLAR_HOLIDAYS[monthDay]) {
    return {
      isHoliday: true,
      name: SOLAR_HOLIDAYS[monthDay].name,
      defaultMultiplier: SOLAR_HOLIDAYS[monthDay].multiplier,
    };
  }

  return null;
}

export const HOLIDAY_PRESETS = [
  { label: 'Bình thường (x1)', multiplier: 1, description: '100% lương' },
  { label: 'Tăng ca (x1.5)', multiplier: 1.5, description: '150% lương' },
  { label: 'Cuối tuần (x2)', multiplier: 2, description: '200% lương' },
  { label: 'Ngày Lễ (x3)', multiplier: 3, description: '300% lương' },
  { label: 'Tết (x4)', multiplier: 4, description: '400% lương' },
];
