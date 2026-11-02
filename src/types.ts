export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color?: string;
}

export interface Shift {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  hourlyRate: number;
  notes?: string;
  hoursWorked: number;
  regularHours?: number;
  bonusHours?: number;
  totalPay: number;
  color?: string;
  isHoliday?: boolean;
  holidayMultiplier?: number; // e.g. 1 (normal), 1.5, 2, 3 (x3), 4 (x4)
  holidayName?: string; // e.g. 'Tết Nguyên Đán', '30/4 - 1/5', 'Quốc khánh 2/9'
  googleEventId?: string;
  syncedToCalendar?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  category?: string;
  account?: string;
  amount: number;
  description: string;
  createdAt?: string;
}

export type NightBonusType = 'percent' | 'fixed';

export interface UserSettings {
  paydayDate?: number; // Ngày phát lương (e.g., 5)
  payrollCutoffDate?: number; // Ngày chốt công (e.g., 25)
  defaultHourlyRate: number;
  nightShiftBonusType?: NightBonusType; // 'percent' (default) or 'fixed'
  nightShiftBonusValue?: number; // e.g. 30 (for 30%) or 10000 (for 10,000 VND/h)
  nightShiftBonusPercent?: number; // kept for legacy compatibility
  defaultHolidayMultiplier?: number; // e.g. 3 (x3) or 4 (x4)
  autoDetectHolidays?: boolean; // Tự động nhận diện và đề xuất ngày lễ Việt Nam
  currency: string;
  shiftTemplates?: ShiftTemplate[];
  expenseCategories?: string[];
  accounts?: string[];
  shiftColor?: string; // Color for work shifts in calendar (e.g. #10b981)
  googleEventColor?: string; // Color for Google Calendar events (e.g. #3b82f6)
  autoSyncGoogleCalendar?: boolean; // Tự động đồng bộ ca làm vào Google Calendar khi tạo
  updatedAt?: string;
}
