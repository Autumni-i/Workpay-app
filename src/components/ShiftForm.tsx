import { useState, useEffect, useMemo, FormEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Shift, UserSettings } from '../types';
import { calculateShiftDetails, formatCurrency } from '../lib/utils';
import { getVietnameseHoliday, HOLIDAY_PRESETS } from '../lib/holidays';
import { PlusCircle, ChevronUp, ChevronDown, Calendar as CalendarIcon, Check, ExternalLink, Sparkles, Flame } from 'lucide-react';
import { hasAccessToken, requestAccessToken } from '../lib/workspace';
import ColorPicker from './ColorPicker';

interface ShiftFormProps {
  onAdd: (shift: Shift, syncToCalendar?: boolean) => void;
  settings: UserSettings;
  shifts: Shift[];
}

export default function ShiftForm({ onAdd, settings, shifts }: ShiftFormProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [hourlyRate, setHourlyRate] = useState(settings.defaultHourlyRate.toString());
  const [notes, setNotes] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  const [syncToCalendar, setSyncToCalendar] = useState<boolean>(settings.autoSyncGoogleCalendar ?? false);
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(hasAccessToken());

  // Holiday calculation state
  const [holidayMultiplier, setHolidayMultiplier] = useState<number>(1);
  const [isCustomMultiplier, setIsCustomMultiplier] = useState<boolean>(false);
  const [customMultiplierInput, setCustomMultiplierInput] = useState<string>('3');
  const [holidayName, setHolidayName] = useState<string>('');

  const detectedHoliday = useMemo(() => getVietnameseHoliday(date), [date]);

  // Auto detect Vietnamese public holidays when date changes
  useEffect(() => {
    if (detectedHoliday && detectedHoliday.isHoliday) {
      if (settings.autoDetectHolidays !== false) {
        setHolidayMultiplier(detectedHoliday.defaultMultiplier);
        setIsCustomMultiplier(false);
        setHolidayName(detectedHoliday.name);
      }
    }
  }, [date, detectedHoliday, settings.autoDetectHolidays]);

  // Update hourly rate if default rate changes in settings
  useEffect(() => {
    setHourlyRate(settings.defaultHourlyRate.toString());
  }, [settings.defaultHourlyRate]);

  // Update sync checkbox if setting changes
  useEffect(() => {
    setSyncToCalendar(settings.autoSyncGoogleCalendar ?? false);
  }, [settings.autoSyncGoogleCalendar]);

  useEffect(() => {
    const handleAuthSuccess = () => setIsGoogleConnected(true);
    const handleAuthExpired = () => setIsGoogleConnected(false);

    window.addEventListener('google-auth-success', handleAuthSuccess);
    window.addEventListener('google-auth-expired', handleAuthExpired);

    return () => {
      window.removeEventListener('google-auth-success', handleAuthSuccess);
      window.removeEventListener('google-auth-expired', handleAuthExpired);
    };
  }, []);

  const handleTemplateSelect = (templateId: string) => {
    if (!templateId) {
      setSelectedColor(undefined);
      return;
    }
    const template = settings.shiftTemplates?.find(t => t.id === templateId);
    if (template) {
      setStartTime(template.startTime);
      setEndTime(template.endTime);
      if (template.color) {
        setSelectedColor(template.color);
      }
    }
  };

  const effectiveMultiplier = isCustomMultiplier
    ? (parseFloat(customMultiplierInput) || 1)
    : holidayMultiplier;

  const currentRate = parseFloat(hourlyRate) || 0;
  const preview = calculateShiftDetails(
    startTime,
    endTime,
    currentRate,
    {
      type: settings.nightShiftBonusType,
      value: settings.nightShiftBonusValue !== undefined ? settings.nightShiftBonusValue : settings.nightShiftBonusPercent
    },
    effectiveMultiplier
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(hourlyRate) || 0;
    const { totalHours, regularHours, bonusHours, totalPay } = calculateShiftDetails(
      startTime,
      endTime,
      rate,
      {
        type: settings.nightShiftBonusType,
        value: settings.nightShiftBonusValue !== undefined ? settings.nightShiftBonusValue : settings.nightShiftBonusPercent
      },
      effectiveMultiplier
    );

    const isHolidayShift = effectiveMultiplier > 1;

    const newShift: Shift = {
      id: uuidv4(),
      date,
      startTime,
      endTime,
      hourlyRate: rate,
      notes,
      hoursWorked: totalHours,
      regularHours,
      bonusHours,
      totalPay: totalPay,
      isHoliday: isHolidayShift,
      holidayMultiplier: effectiveMultiplier,
      holidayName: isHolidayShift ? (holidayName.trim() || detectedHoliday?.name || `Lễ x${effectiveMultiplier}`) : undefined,
      ...(selectedColor ? { color: selectedColor } : {}),
    };
    
    onAdd(newShift, syncToCalendar);
    setNotes('');
    if (!isHolidayShift) {
      setHolidayName('');
    }
    adjustDate(1);
  };

  const adjustDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const adjustTime = (timeStr: string, addMinutes: number, setter: (val: string) => void) => {
    if (!timeStr) return;
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    d.setMinutes(d.getMinutes() + addMinutes);
    const newH = String(d.getHours()).padStart(2, '0');
    const newM = String(d.getMinutes()).padStart(2, '0');
    setter(`${newH}:${newM}`);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl p-6 border border-white/10 shadow-xl flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest min-w-max">Thêm ca làm</h2>
        {settings.shiftTemplates && settings.shiftTemplates.length > 0 && (
          <select 
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-white/30 flex-1 min-w-[120px]"
            defaultValue=""
          >
            <option value="" disabled>Chọn mẫu ca...</option>
            {settings.shiftTemplates.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.startTime} - {t.endTime})</option>
            ))}
          </select>
        )}
      </div>

      {/* Holiday auto-detection banner */}
      {detectedHoliday && detectedHoliday.isHoliday && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-semibold text-amber-300">Phát hiện ngày lễ: </span>
              <span>{detectedHoliday.name}</span>
            </div>
          </div>
          {effectiveMultiplier === 1 && (
            <button
              type="button"
              onClick={() => {
                setHolidayMultiplier(detectedHoliday.defaultMultiplier);
                setIsCustomMultiplier(false);
                setHolidayName(detectedHoliday.name);
              }}
              className="bg-amber-400 hover:bg-amber-300 text-black px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0 transition-colors"
            >
              Áp dụng x{detectedHoliday.defaultMultiplier}
            </button>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/60 ml-1">Ngày làm việc</label>
          <div className="flex bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:border-white/30 transition-colors">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 w-full bg-transparent px-4 py-2.5 text-sm focus:outline-none text-white [color-scheme:dark]"
            />
            <div className="flex flex-col border-l border-white/5 w-8 bg-white/5 shrink-0">
              <button 
                type="button" 
                onClick={() => adjustDate(1)}
                className="flex-1 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button 
                type="button" 
                onClick={() => adjustDate(-1)}
                className="flex-1 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors border-t border-white/5"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/60 ml-1">Lương cơ bản/h</label>
          <input
            type="number"
            required
            min="0"
            step="any"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 text-white [color-scheme:dark]"
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/60 ml-1">Bắt đầu</label>
          <div className="flex bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:border-white/30 transition-colors">
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="flex-1 w-full bg-transparent px-4 py-2.5 text-sm focus:outline-none text-white [color-scheme:dark]"
            />
            <div className="flex flex-col border-l border-white/5 w-8 bg-white/5 shrink-0">
              <button type="button" onClick={() => adjustTime(startTime, 60, setStartTime)} className="flex-1 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                <ChevronUp className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => adjustTime(startTime, -60, setStartTime)} className="flex-1 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors border-t border-white/5">
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/60 ml-1">Kết thúc</label>
          <div className="flex bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:border-white/30 transition-colors">
            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="flex-1 w-full bg-transparent px-4 py-2.5 text-sm focus:outline-none text-white [color-scheme:dark]"
            />
            <div className="flex flex-col border-l border-white/5 w-8 bg-white/5 shrink-0">
              <button type="button" onClick={() => adjustTime(endTime, 60, setEndTime)} className="flex-1 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                <ChevronUp className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => adjustTime(endTime, -60, setEndTime)} className="flex-1 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors border-t border-white/5">
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Holiday Multiplier Selector (x1, x1.5, x2, x3, x4, Custom) */}
      <div className="bg-black/40 border border-white/10 rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
            <Flame className={`w-3.5 h-3.5 ${effectiveMultiplier > 1 ? 'text-rose-400' : 'text-white/40'}`} />
            <span>Hệ số lương Ngày Lễ / Tết</span>
          </div>
          {effectiveMultiplier > 1 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              x{effectiveMultiplier} ({Math.round(effectiveMultiplier * 100)}% lương)
            </span>
          )}
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setHolidayMultiplier(1);
              setIsCustomMultiplier(false);
            }}
            className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border ${
              !isCustomMultiplier && holidayMultiplier === 1
                ? 'bg-white text-black border-white shadow-md'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            x1 Thường
          </button>

          <button
            type="button"
            onClick={() => {
              setHolidayMultiplier(1.5);
              setIsCustomMultiplier(false);
            }}
            className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border ${
              !isCustomMultiplier && holidayMultiplier === 1.5
                ? 'bg-amber-400 text-black border-amber-400 shadow-md'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            x1.5
          </button>

          <button
            type="button"
            onClick={() => {
              setHolidayMultiplier(2);
              setIsCustomMultiplier(false);
            }}
            className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border ${
              !isCustomMultiplier && holidayMultiplier === 2
                ? 'bg-orange-400 text-black border-orange-400 shadow-md'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            x2
          </button>

          <button
            type="button"
            onClick={() => {
              setHolidayMultiplier(3);
              setIsCustomMultiplier(false);
              if (!holidayName && detectedHoliday?.name) setHolidayName(detectedHoliday.name);
            }}
            className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border ${
              !isCustomMultiplier && holidayMultiplier === 3
                ? 'bg-rose-500 text-white border-rose-500 shadow-md'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            x3 Lễ
          </button>

          <button
            type="button"
            onClick={() => {
              setHolidayMultiplier(4);
              setIsCustomMultiplier(false);
              if (!holidayName && detectedHoliday?.name) setHolidayName(detectedHoliday.name);
            }}
            className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border ${
              !isCustomMultiplier && holidayMultiplier === 4
                ? 'bg-gradient-to-r from-red-600 to-amber-500 text-white border-amber-400 shadow-md'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            x4 Tết
          </button>
        </div>

        {/* Custom multiplier or holiday label */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsCustomMultiplier(!isCustomMultiplier)}
              className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${
                isCustomMultiplier 
                  ? 'bg-white/20 text-white border-white/30 font-medium' 
                  : 'bg-transparent text-white/40 border-white/10 hover:text-white/70'
              }`}
            >
              Hệ số khác
            </button>
            {isCustomMultiplier && (
              <div className="flex items-center bg-black/60 border border-white/15 rounded-lg px-2 py-1">
                <span className="text-xs text-white/40 mr-1">x</span>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="10"
                  value={customMultiplierInput}
                  onChange={(e) => setCustomMultiplierInput(e.target.value)}
                  className="w-12 bg-transparent text-xs text-white focus:outline-none font-semibold"
                />
              </div>
            )}
          </div>

          {effectiveMultiplier > 1 && (
            <input
              type="text"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              placeholder="Tên ngày lễ (VD: Tết Nguyên Đán, 30/4...)"
              className="flex-1 bg-black/60 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/40"
            />
          )}
        </div>
      </div>
      
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-white/60 ml-1">Ghi chú (Tùy chọn)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="VD: Làm ca sáng, thu ngân..."
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 text-white placeholder-white/30"
        />
      </div>

      <div className="pt-0.5">
        <ColorPicker
          value={selectedColor || settings.shiftColor || '#10b981'}
          onChange={(col) => setSelectedColor(col)}
          label="Màu ca làm này (Tùy chọn)"
        />
      </div>

      {/* Google Calendar Direct Sync Option */}
      <div className={`border rounded-2xl p-4 transition-colors ${
        syncToCalendar 
          ? 'bg-emerald-500/[0.06] border-emerald-500/30' 
          : 'bg-black/40 border-white/10'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${
              syncToCalendar 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : 'bg-white/5 text-white/50 border-white/10'
            }`}>
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white/90">Thêm vào Google Calendar</span>
                {settings.autoSyncGoogleCalendar && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Tự động
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/40 mt-0.5">
                {syncToCalendar 
                  ? 'Ca làm này sẽ được đồng bộ ngay vào Google Calendar khi Lưu'
                  : 'Chỉ lưu nội bộ trong Workpay'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {syncToCalendar && !isGoogleConnected && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    requestAccessToken();
                  } catch (err: any) {
                    alert(err.message || 'Không thể kết nối');
                  }
                }}
                className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1"
              >
                <span>Kết nối</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}

            <button
              type="button"
              role="switch"
              aria-checked={syncToCalendar}
              onClick={() => {
                const nextState = !syncToCalendar;
                setSyncToCalendar(nextState);
                if (nextState && !isGoogleConnected) {
                  try {
                    requestAccessToken();
                  } catch (err) {}
                }
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                syncToCalendar ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-white/15'
              }`}
              title={syncToCalendar ? 'Tắt thêm vào Google Calendar' : 'Bật thêm vào Google Calendar'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  syncToCalendar ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Real-time calculated preview */}
      <div className="bg-black/30 border border-white/5 rounded-2xl p-3.5 flex items-center justify-between text-xs">
        <div className="space-y-1">
          <div className="text-white/70">
            Tổng: <span className="font-semibold text-white">{preview.totalHours.toFixed(1)}h</span>
            {preview.bonusHours > 0 && (
              <span className="text-white/80 ml-1.5 font-medium">
                ({preview.bonusHours.toFixed(1)}h sau 22h)
              </span>
            )}
          </div>
          <div className="text-[11px] text-white/50 flex flex-wrap gap-x-2">
            <span>Lương tính: <span className="text-white font-medium">{formatCurrency(preview.effectiveBaseRate, settings.currency)}/h</span>{effectiveMultiplier > 1 && ` (x${effectiveMultiplier})`}</span>
            {preview.bonusHours > 0 && (
              <span>• Sau 22h: <span className="text-white font-medium">{formatCurrency(preview.nightRate, settings.currency)}/h</span></span>
            )}
          </div>
        </div>
        <div className="text-right pl-2">
          <div className="text-[10px] text-white/40 uppercase font-medium">Tạm tính</div>
          <div className="text-base font-bold text-white">
            {formatCurrency(preview.totalPay, settings.currency)}
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-white text-black py-3 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all mt-1 flex items-center justify-center gap-2 shadow-md active:scale-[0.99]"
      >
        <PlusCircle className="w-5 h-5" />
        <span>Lưu ca làm (Save Shift)</span>
      </button>
    </form>
  );
}
