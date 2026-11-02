import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateShiftDetails(
  startTime: string,
  endTime: string,
  rate: number,
  nightConfig?: { type?: 'percent' | 'fixed'; value?: number; percent?: number } | number,
  holidayMultiplier: number = 1
) {
  let nightType: 'percent' | 'fixed' = 'percent';
  let nightValue = 130;

  if (typeof nightConfig === 'number') {
    nightType = 'percent';
    nightValue = nightConfig;
  } else if (nightConfig) {
    nightType = nightConfig.type || 'percent';
    nightValue = nightConfig.value !== undefined ? nightConfig.value : (nightConfig.percent ?? 130);
  }

  const mult = holidayMultiplier > 0 ? holidayMultiplier : 1;
  const effectiveBaseRate = rate * mult;

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  const start = new Date();
  start.setHours(startH, startM, 0, 0);
  
  let end = new Date();
  end.setHours(endH, endM, 0, 0);
  
  if (end <= start) {
    // Crosses midnight
    end.setDate(end.getDate() + 1);
  }
  
  let regularMinutes = 0;
  let nightMinutes = 0;
  
  let current = new Date(start);
  while (current < end) {
    const hour = current.getHours();
    // Night hours: 22:00 to 05:59
    if (hour >= 22 || hour < 6) {
      nightMinutes++;
    } else {
      regularMinutes++;
    }
    current.setMinutes(current.getMinutes() + 1);
  }
  
  const regularHours = regularMinutes / 60;
  const nightHours = nightMinutes / 60;
  const totalHours = regularHours + nightHours;
  
  let nightRate = effectiveBaseRate;
  if (nightType === 'fixed') {
    // Direct hourly wage after 22h (scaled with holiday multiplier if set)
    nightRate = nightValue > 0 ? (nightValue * mult) : effectiveBaseRate;
  } else {
    // Percentage: 130% or +30% -> effectiveBaseRate * 1.3
    if (nightValue >= 100) {
      nightRate = effectiveBaseRate * (nightValue / 100);
    } else if (nightValue > 0) {
      nightRate = effectiveBaseRate * (1 + nightValue / 100);
    }
  }
  
  const totalPay = (regularHours * effectiveBaseRate) + (nightHours * nightRate);
  
  return {
    totalHours,
    regularHours,
    bonusHours: nightHours, // keep property name for backwards compatibility
    nightHours,
    effectiveBaseRate,
    nightRate,
    holidayMultiplier: mult,
    totalPay
  };
}

export function calculateHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  const start = new Date();
  start.setHours(startH, startM, 0, 0);
  
  let end = new Date();
  end.setHours(endH, endM, 0, 0);
  
  if (end < start) {
    // Crosses midnight
    end.setDate(end.getDate() + 1);
  }
  
  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60);
}

export function formatCurrency(amount: number, currency: string = 'VND'): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}
