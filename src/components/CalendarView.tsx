import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, dateFnsLocalizer, View, Messages } from 'react-big-calendar';
import { 
  format, 
  parse, 
  startOfWeek, 
  endOfWeek, 
  getDay, 
  addMonths, 
  subMonths, 
  addWeeks, 
  subWeeks, 
  addDays, 
  subDays,
  isToday,
  isTomorrow,
  isYesterday,
  isSameDay,
  isBefore,
  startOfDay,
  endOfDay
} from 'date-fns';
import { vi } from 'date-fns/locale/vi';
import { Shift, UserSettings } from '../types';
import { fetchCalendarEvents, hasAccessToken, requestAccessToken, deleteGoogleCalendarEvent, addShiftToCalendar } from '../lib/workspace';
import { formatCurrency } from '../lib/utils';
import { 
  Calendar as CalendarIcon, 
  RefreshCw, 
  LogIn, 
  X, 
  Clock, 
  DollarSign, 
  Briefcase, 
  MapPin, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
  CalendarDays,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  MousePointer,
  Trash2,
  Loader2,
  ArrowUpDown,
  CalendarPlus,
  Flame,
  Pencil,
  Plus
} from 'lucide-react';
import EditShiftModal from './EditShiftModal';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'vi': vi,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }), // Start on Monday
  getDay,
  locales,
});

interface CalendarViewProps {
  shifts: Shift[];
  settings?: UserSettings;
  onDeleteShift?: (id: string) => void;
  onUpdateShift?: (shift: Shift) => void;
  onAddShift?: (shift: Shift, syncToGoogle?: boolean) => void;
}

interface CalendarEvent {
  id?: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: any;
  type?: 'shift' | 'google';
  color?: string;
  rawShift?: Shift;
  rawGoogleEvent?: any;
}

type FilterType = 'all' | 'shifts' | 'google';

function parseGoogleEventDates(item: any): { start: Date; end: Date; allDay: boolean } {
  // Timed event (has dateTime e.g. "2026-08-20T09:00:00+07:00")
  if (item.start?.dateTime || item.end?.dateTime) {
    const start = new Date(item.start?.dateTime || item.start?.date);
    const end = new Date(item.end?.dateTime || item.end?.date || item.start?.dateTime);
    return { start, end, allDay: false };
  }

  // All-day event: Google provides dates like "2026-08-20"
  if (item.start?.date) {
    const [sy, sm, sd] = item.start.date.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);

    let end = start;
    if (item.end?.date) {
      const [ey, em, ed] = item.end.date.split('-').map(Number);
      const rawEnd = new Date(ey, em - 1, ed, 0, 0, 0, 0);
      if (rawEnd > start) {
        end = new Date(rawEnd.getTime() - 1000);
      } else {
        end = new Date(sy, sm - 1, sd, 23, 59, 59, 999);
      }
    } else {
      end = new Date(sy, sm - 1, sd, 23, 59, 59, 999);
    }

    return { start, end, allDay: true };
  }

  return { start: new Date(), end: new Date(), allDay: false };
}

export default function CalendarView({ shifts, settings, onDeleteShift, onUpdateShift, onAddShift }: CalendarViewProps) {
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingEventId, setIsDeletingEventId] = useState<string | null>(null);
  const [isSyncingShiftId, setIsSyncingShiftId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>('month');
  const [filter, setFilter] = useState<FilterType>('all');
  const [isConnected, setIsConnected] = useState(hasAccessToken());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected date for day detail modal & editing shift
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  // Agenda search and scope filters
  const [agendaSearch, setAgendaSearch] = useState('');
  const [agendaRange, setAgendaRange] = useState<'month' | 'upcoming' | 'all'>('month');

  // Smooth Month Navigation with Fluid Transition State
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | 'none'>('none');
  const wheelAccumulator = useRef<number>(0);
  const wheelTimer = useRef<any>(null);
  const isTransitioning = useRef<boolean>(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Manual sync shift to Google Calendar handler
  const handleSyncShiftToGoogle = async (shift: Shift, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hasAccessToken()) {
      try {
        requestAccessToken();
      } catch (err: any) {
        setErrorMessage(err.message || 'Cần kết nối tài khoản Google Calendar');
      }
      return;
    }

    try {
      setIsSyncingShiftId(shift.id);
      await addShiftToCalendar(shift, currency);
      // Reload google events to immediately show the new event on the calendar
      await loadGoogleEvents(currentDate);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể thêm ca làm việc vào Google Calendar.');
    } finally {
      setIsSyncingShiftId(null);
    }
  };

  // Delete handlers
  const handleDeleteGoogleEvent = async (eventId: string, title: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!eventId) return;

    if (!window.confirm(`Bạn có chắc chắn muốn xóa sự kiện "${title || 'này'}" khỏi Google Calendar không?`)) {
      return;
    }

    try {
      setIsDeletingEventId(eventId);
      await deleteGoogleCalendarEvent(eventId);
      setGoogleEvents(prev => prev.filter(item => item.id !== eventId && item.rawGoogleEvent?.id !== eventId));
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể xóa sự kiện Google Calendar.');
    } finally {
      setIsDeletingEventId(null);
    }
  };

  const handleDeleteShiftClick = (shiftId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!shiftId) return;
    if (onDeleteShift) {
      onDeleteShift(shiftId);
    }
  };

  const handleCalendarWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Only in Month view
    if (view !== 'month') return;
    
    if (isTransitioning.current) return;
    
    // Natural up/down wheel delta (or horizontal trackpad scroll)
    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    
    // Accumulate scroll input for natural inertial feel
    wheelAccumulator.current += delta;

    if (wheelTimer.current) {
      clearTimeout(wheelTimer.current);
    }
    wheelTimer.current = setTimeout(() => {
      wheelAccumulator.current = 0;
    }, 200);

    const THRESHOLD = 32; // Highly responsive & smooth threshold

    if (wheelAccumulator.current > THRESHOLD) {
      isTransitioning.current = true;
      wheelAccumulator.current = 0;
      handleNavigate('NEXT');
      setTimeout(() => {
        isTransitioning.current = false;
      }, 280);
    } else if (wheelAccumulator.current < -THRESHOLD) {
      isTransitioning.current = true;
      wheelAccumulator.current = 0;
      handleNavigate('PREV');
      setTimeout(() => {
        isTransitioning.current = false;
      }, 280);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    if (e.changedTouches.length === 1 && view === 'month' && !isTransitioning.current) {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      
      // Support vertical swipe (swipe up -> next month, swipe down -> prev month)
      if (Math.abs(deltaY) >= Math.abs(deltaX) && Math.abs(deltaY) > 35) {
        isTransitioning.current = true;
        if (deltaY < 0) {
          handleNavigate('NEXT');
        } else {
          handleNavigate('PREV');
        }
        setTimeout(() => {
          isTransitioning.current = false;
        }, 280);
      } else if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 35) {
        // Also support horizontal swipe
        isTransitioning.current = true;
        if (deltaX < 0) {
          handleNavigate('NEXT');
        } else {
          handleNavigate('PREV');
        }
        setTimeout(() => {
          isTransitioning.current = false;
        }, 280);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const currency = settings?.currency || 'VND';
  const defaultShiftColor = settings?.shiftColor || '#10b981';
  const defaultGoogleColor = settings?.googleEventColor || '#3b82f6';

  const shiftEvents: CalendarEvent[] = useMemo(() => shifts.map(shift => {
    const [year, month, day] = shift.date.split('-').map(Number);
    const [sh, sm] = (shift.startTime || '00:00').split(':').map(Number);
    const [eh, em] = (shift.endTime || '00:00').split(':').map(Number);

    const start = new Date(year, month - 1, day, sh || 0, sm || 0, 0);
    let end = new Date(year, month - 1, day, eh || 0, em || 0, 0);
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    const mult = shift.holidayMultiplier || (shift.isHoliday ? 3 : 1);
    const holidaySuffix = mult > 1 ? ` 🔥x${mult}` : '';

    return {
      id: shift.id,
      title: `${shift.startTime}-${shift.endTime}${holidaySuffix} (${shift.hoursWorked.toFixed(1)}h)`,
      start,
      end,
      allDay: false,
      type: 'shift',
      color: shift.color || defaultShiftColor,
      rawShift: shift
    };
  }), [shifts, defaultShiftColor]);

  const loadGoogleEvents = useCallback(async (date: Date) => {
    if (!hasAccessToken()) {
      setIsConnected(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Fetch 1 month before and after current view
      const timeMin = new Date(date.getFullYear(), date.getMonth() - 1, 1).toISOString();
      const timeMax = new Date(date.getFullYear(), date.getMonth() + 2, 0, 23, 59, 59).toISOString();
      
      const items = await fetchCalendarEvents(timeMin, timeMax);
      
      const mappedEvents: CalendarEvent[] = items.map((item: any) => {
        const { start, end, allDay } = parseGoogleEventDates(item);
        return {
          id: item.id,
          title: item.summary || 'Sự kiện',
          start,
          end,
          allDay,
          type: 'google',
          color: item.computedColor,
          rawGoogleEvent: item
        };
      });
      
      setGoogleEvents(mappedEvents);
      setIsConnected(true);
    } catch (err: any) {
      console.error('Failed to load Google events', err);
      setIsConnected(hasAccessToken());
      setErrorMessage(err.message || 'Không thể đồng bộ Google Calendar');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsConnected(hasAccessToken());
    if (hasAccessToken()) {
      loadGoogleEvents(currentDate);
    }
    
    const handleAuthSuccess = () => {
      setIsConnected(true);
      setErrorMessage(null);
      loadGoogleEvents(currentDate);
    };

    const handleAuthExpired = () => {
      setIsConnected(false);
      setGoogleEvents([]);
    };
    
    window.addEventListener('google-auth-success', handleAuthSuccess);
    window.addEventListener('google-auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('google-auth-success', handleAuthSuccess);
      window.removeEventListener('google-auth-expired', handleAuthExpired);
    };
  }, [currentDate, loadGoogleEvents]);

  const handleConnect = () => {
    setErrorMessage(null);
    try {
      requestAccessToken();
    } catch (e: any) {
      setErrorMessage(e.message || 'Không thể khởi tạo kết nối Google.');
    }
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date; slots: Date[]; action: 'select' | 'click' | 'doubleClick' }) => {
    setSelectedDate(slotInfo.start);
    setIsDetailOpen(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedDate(event.start);
    setIsDetailOpen(true);
  };

  const handleDrillDown = (date: Date) => {
    setSelectedDate(date);
    setIsDetailOpen(true);
  };

  // Filter events based on active filter
  const displayedEvents = useMemo(() => {
    if (filter === 'shifts') return shiftEvents;
    if (filter === 'google') return googleEvents;
    return [...shiftEvents, ...googleEvents];
  }, [filter, shiftEvents, googleEvents]);

  // Event style getter with clean modern look
  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = event.color || event.rawGoogleEvent?.computedColor || defaultGoogleColor;
    let textColor = event.rawGoogleEvent?.computedForegroundColor || '#ffffff';
    
    if (event.type === 'shift') {
      backgroundColor = event.color || event.rawShift?.color || defaultShiftColor;
      textColor = '#ffffff';
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '8px',
        opacity: 0.96,
        color: textColor,
        border: 'none',
        display: 'block',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '0.75rem',
        padding: '2px 6px',
        boxShadow: `0 2px 6px ${backgroundColor}33`,
        transition: 'transform 0.1s ease, box-shadow 0.1s ease',
      }
    };
  };

  const messages: Messages = {
    allDay: 'Cả ngày',
    previous: 'Trước',
    next: 'Sau',
    today: 'Hôm nay',
    month: 'Tháng',
    week: 'Tuần',
    day: 'Ngày',
    agenda: 'Lịch trình',
    date: 'Ngày',
    time: 'Thời gian',
    event: 'Sự kiện & Ca làm',
    noEventsInRange: 'Không có ca làm hoặc lịch trình nào trong khoảng thời gian này.',
    showMore: (count) => `+ ${count} sự kiện khác`,
  };

  // Navigate functions
  const handleNavigate = (direction: 'PREV' | 'NEXT' | 'TODAY') => {
    if (direction === 'TODAY') {
      setSlideDirection('none');
      setCurrentDate(new Date());
      return;
    }

    setSlideDirection(direction === 'NEXT' ? 'next' : 'prev');

    if (view === 'month') {
      setCurrentDate(direction === 'NEXT' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(direction === 'NEXT' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else if (view === 'day') {
      setCurrentDate(direction === 'NEXT' ? addDays(currentDate, 1) : subDays(currentDate, 1));
    } else if (view === 'agenda') {
      setCurrentDate(direction === 'NEXT' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    }
  };

  // Header Title
  const formattedHeaderTitle = useMemo(() => {
    if (view === 'month') {
      return format(currentDate, 'MMMM, yyyy', { locale: vi });
    }
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM/yyyy')}`;
    }
    if (view === 'day') {
      return format(currentDate, 'EEEE, dd/MM/yyyy', { locale: vi });
    }
    if (view === 'agenda') {
      return `Lịch trình tháng ${format(currentDate, 'MM/yyyy')}`;
    }
    return format(currentDate, 'MMMM yyyy', { locale: vi });
  }, [currentDate, view]);

  // Statistics for the current cycle in view
  const currentViewStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const cutoff = settings.payrollCutoffDate;
    let cycleStart: Date;
    let cycleEnd: Date;
    
    if (cutoff && cutoff >= 1 && cutoff <= 31) {
      // Create date without caring about month overflow initially, Date handles it
      // if month is February and cutoff is 30, it will roll over to March. 
      // But we want to cap it to the end of the month.
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      const actualCutoff = Math.min(cutoff, lastDayOfMonth);
      
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      const actualPrevCutoff = Math.min(cutoff, prevMonthLastDay);
      
      cycleStart = new Date(year, month - 1, actualPrevCutoff + 1, 0, 0, 0, 0);
      cycleEnd = new Date(year, month, actualCutoff, 23, 59, 59, 999);
    } else {
      cycleStart = new Date(year, month, 1, 0, 0, 0, 0);
      cycleEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    }

    const monthShifts = shifts.filter(s => {
      // Use noon time to avoid timezone edge cases with local dates
      const shiftDate = new Date(s.date + 'T12:00:00');
      return shiftDate >= cycleStart && shiftDate <= cycleEnd;
    });

    const totalHours = monthShifts.reduce((sum, s) => sum + s.hoursWorked, 0);
    const totalPay = monthShifts.reduce((sum, s) => sum + s.totalPay, 0);
    const shiftCount = monthShifts.length;

    const monthGoogleCount = googleEvents.filter(e => {
      return e.start >= cycleStart && e.start <= cycleEnd;
    }).length;

    return {
      shiftCount,
      totalHours,
      totalPay,
      monthGoogleCount,
      cycleStart,
      cycleEnd
    };
  }, [currentDate, shifts, googleEvents, settings.payrollCutoffDate]);

  // Compute shifts & google events for the selected date
  const selectedDateDetails = useMemo(() => {
    if (!selectedDate) return { dayShifts: [], dayGoogleEvents: [], totalHours: 0, totalPay: 0 };
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    const dayShifts = shifts.filter(s => s.date === dateStr);
    const totalHours = dayShifts.reduce((sum, s) => sum + s.hoursWorked, 0);
    const totalPay = dayShifts.reduce((sum, s) => sum + s.totalPay, 0);

    const startOfDayTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0);
    const endOfDayTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999);

    const dayGoogleEvents = googleEvents.filter(e => {
      return e.start <= endOfDayTime && e.end >= startOfDayTime;
    });

    return { dayShifts, dayGoogleEvents, totalHours, totalPay };
  }, [selectedDate, shifts, googleEvents]);

  // Group events for the dedicated Agenda (Lịch trình) View
  const agendaGroupedDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const rangeStart = agendaRange === 'month' 
      ? new Date(year, month, 1, 0, 0, 0)
      : agendaRange === 'upcoming' 
        ? startOfDay(new Date()) 
        : new Date(2020, 0, 1);

    const rangeEnd = agendaRange === 'month'
      ? new Date(year, month + 1, 0, 23, 59, 59, 999)
      : agendaRange === 'upcoming'
        ? addDays(startOfDay(new Date()), 30)
        : new Date(2035, 0, 1);

    const dateMap = new Map<string, {
      date: Date;
      dateStr: string;
      shifts: Shift[];
      googleEvents: CalendarEvent[];
      totalHours: number;
      totalPay: number;
    }>();

    // Add shifts (respecting filter)
    if (filter === 'all' || filter === 'shifts') {
      shifts.forEach(shift => {
        const [sy, sm, sd] = shift.date.split('-').map(Number);
        const shiftDate = new Date(sy, sm - 1, sd);
        if (shiftDate >= rangeStart && shiftDate <= rangeEnd) {
          if (agendaSearch.trim()) {
            const q = agendaSearch.toLowerCase();
            const match = (shift.notes && shift.notes.toLowerCase().includes(q)) ||
              shift.date.includes(q) ||
              shift.startTime.includes(q) ||
              shift.endTime.includes(q);
            if (!match) return;
          }

          if (!dateMap.has(shift.date)) {
            dateMap.set(shift.date, {
              date: shiftDate,
              dateStr: shift.date,
              shifts: [],
              googleEvents: [],
              totalHours: 0,
              totalPay: 0,
            });
          }
          const group = dateMap.get(shift.date)!;
          group.shifts.push(shift);
          group.totalHours += shift.hoursWorked;
          group.totalPay += shift.totalPay;
        }
      });
    }

    // Add google events (respecting filter)
    if (filter === 'all' || filter === 'google') {
      googleEvents.forEach(evt => {
        if (evt.start >= rangeStart && evt.start <= rangeEnd) {
          const dateStr = format(evt.start, 'yyyy-MM-dd');
          
          if (agendaSearch.trim()) {
            const q = agendaSearch.toLowerCase();
            const raw = evt.rawGoogleEvent;
            const match = evt.title.toLowerCase().includes(q) ||
              (raw?.description && raw.description.toLowerCase().includes(q)) ||
              (raw?.location && raw.location.toLowerCase().includes(q));
            if (!match) return;
          }

          if (!dateMap.has(dateStr)) {
            dateMap.set(dateStr, {
              date: new Date(evt.start.getFullYear(), evt.start.getMonth(), evt.start.getDate()),
              dateStr,
              shifts: [],
              googleEvents: [],
              totalHours: 0,
              totalPay: 0,
            });
          }
          const group = dateMap.get(dateStr)!;
          group.googleEvents.push(evt);
        }
      });
    }

    // Sort by date ascending
    const sortedGroups = Array.from(dateMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    
    sortedGroups.forEach(g => {
      g.shifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
      g.googleEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
    });

    return sortedGroups;
  }, [currentDate, agendaRange, shifts, googleEvents, filter, agendaSearch]);

  return (
    <div className="flex flex-col h-full bg-white/[0.03] backdrop-blur-3xl rounded-3xl border border-white/10 p-4 md:p-6 min-h-[640px] relative shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
      {/* Modern Top Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-white/5">
        {/* Navigation & Title */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-[#1C1C1E] rounded-2xl p-1 border border-white/10 shadow-sm">
            <button
              onClick={() => handleNavigate('PREV')}
              className="p-2 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-all"
              title="Khoảng thời gian trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleNavigate('TODAY')}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${
                isToday(currentDate)
                  ? 'bg-white/10 text-white/80 font-semibold'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => handleNavigate('NEXT')}
              className="p-2 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-all"
              title="Khoảng thời gian sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <h2 className="text-base md:text-lg font-semibold text-white tracking-tight capitalize">
              {formattedHeaderTitle}
            </h2>
            {isToday(currentDate) && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-white/5 text-white/90 border border-white/10 px-2.5 py-0.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-pulse"></span>
                Hiện tại
              </span>
            )}
          </div>
        </div>

        {/* View Switcher & Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap justify-between lg:justify-end">
          {/* Segmented View Switcher */}
          <div className="flex items-center bg-[#1C1C1E] p-1 rounded-2xl border border-white/10 shadow-sm text-xs">
            {(['month', 'week', 'day', 'agenda'] as const).map((v) => {
              const labels = {
                month: 'Tháng',
                week: 'Tuần',
                day: 'Ngày',
                agenda: 'Lịch trình'
              };
              const isActive = view === v;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                    isActive
                      ? 'bg-white/15 text-white shadow-sm font-semibold'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  {labels[v]}
                </button>
              );
            })}
          </div>

          {/* Google Sync Button */}
          <div>
            {!isConnected ? (
              <button
                onClick={handleConnect}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white/90 border border-white/30 font-medium py-1.5 px-3 rounded-2xl transition-all text-xs shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Kết nối Google Calendar</span>
              </button>
            ) : (
              <button
                onClick={() => loadGoogleEvents(currentDate)}
                disabled={isLoading}
                title="Đã kết nối Google Calendar - Nhấn để đồng bộ lại"
                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/75 font-medium py-1.5 px-3 rounded-2xl transition-all text-xs disabled:opacity-50 border border-white/10 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-white/90' : 'text-white/90'}`} />
                <span className="hidden sm:inline">Đồng bộ</span>
                <CheckCircle2 className="w-3 h-3 text-white/90 ml-0.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Chips & Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 text-xs">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-white/40 text-[11px] font-medium mr-1">Hiển thị:</span>
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-xl font-medium transition-all ${
              filter === 'all'
                ? 'bg-white/15 text-white border border-white/20'
                : 'bg-white/[0.02] text-white/50 hover:text-white/80 border border-white/5'
            }`}
          >
            Tất cả ({shiftEvents.length + googleEvents.length})
          </button>
          <button
            onClick={() => setFilter('shifts')}
            className={`px-2.5 py-1 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
              filter === 'shifts'
                ? 'bg-white/10 text-white/80 border border-white/40'
                : 'bg-white/[0.02] text-white/50 hover:text-white/80 border border-white/5'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: defaultShiftColor }} />
            Ca làm việc ({shiftEvents.length})
          </button>
          <button
            onClick={() => setFilter('google')}
            className={`px-2.5 py-1 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
              filter === 'google'
                ? 'bg-white/20 text-white/80 border border-white/40'
                : 'bg-white/[0.02] text-white/50 hover:text-white/80 border border-white/5'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: defaultGoogleColor }} />
            Google Calendar ({googleEvents.length})
          </button>
        </div>

        {/* Quick Month Metrics */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0 self-start sm:self-auto">
          {settings.payrollCutoffDate && (
            <div className="text-[10px] text-white/50 px-2.5 py-1.5 bg-white/[0.03] rounded-xl border border-white/5 flex items-center gap-1.5">
              <span>Kỳ lương: <strong className="text-white/70">{format(currentViewStats.cycleStart, 'dd/MM')} - {format(currentViewStats.cycleEnd, 'dd/MM')}</strong></span>
              {settings.paydayDate && (
                <>
                  <div className="w-px h-2.5 bg-white/20" />
                  <span>Nhận lương: <strong className="text-white/70">{String(settings.paydayDate).padStart(2, '0')}/{format(new Date(currentViewStats.cycleEnd.getFullYear(), currentViewStats.cycleEnd.getMonth() + 1, 1), 'MM')}</strong></span>
                </>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 text-white/60 bg-white/[0.02] px-3 py-1.5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-white/90" />
              <span className="font-semibold text-white">{currentViewStats.totalHours.toFixed(1)}h</span>
              <span className="text-white/40">({currentViewStats.shiftCount} ca)</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-white/90" />
              <span className="font-semibold text-white/90">{formatCurrency(currentViewStats.totalPay, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-2xl bg-white/10 border border-white/20 text-white/60 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-white/70 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={handleConnect}
            className="px-3 py-1 rounded-xl bg-white/20 hover:bg-amber-500/30 text-amber-200 font-medium whitespace-nowrap transition-colors"
          >
            Kết nối lại
          </button>
        </div>
      )}

      {/* Main Calendar or Agenda View Container */}
      <div className="flex-1 min-h-[540px] flex flex-col">
        {view === 'agenda' ? (
          /* Dedicated Modern Agenda (Lịch trình) Timeline View */
          <div className="flex-1 flex flex-col space-y-4">
            {/* Agenda Controls & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/[0.03] backdrop-blur-xl p-3 rounded-2xl border border-white/10 shadow-lg">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Tìm kiếm ca làm, ghi chú, sự kiện..."
                  value={agendaSearch}
                  onChange={(e) => setAgendaSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-colors"
                />
                {agendaSearch && (
                  <button
                    onClick={() => setAgendaSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Range Filters */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto bg-black/30 p-1 rounded-xl border border-white/5 text-xs">
                <button
                  onClick={() => setAgendaRange('month')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    agendaRange === 'month'
                      ? 'bg-white/10 text-white/80 font-semibold border border-white/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Tháng {format(currentDate, 'MM/yyyy')}
                </button>
                <button
                  onClick={() => setAgendaRange('upcoming')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    agendaRange === 'upcoming'
                      ? 'bg-white/10 text-white/80 font-semibold border border-white/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  30 ngày tới
                </button>
                <button
                  onClick={() => setAgendaRange('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    agendaRange === 'all'
                      ? 'bg-white/10 text-white/80 font-semibold border border-white/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Tất cả
                </button>
              </div>
            </div>

            {/* Agenda Timeline List with Smooth Scrollbar */}
            <div className="flex-1 overflow-y-auto max-h-[580px] pr-1 space-y-4 modal-scroll-body">
              {agendaGroupedDays.length > 0 ? (
                agendaGroupedDays.map((group) => {
                  const isCurrentDay = isToday(group.date);
                  const isTomorrowDay = isTomorrow(group.date);
                  const isPast = isBefore(endOfDay(group.date), new Date()) && !isCurrentDay;

                  return (
                    <div 
                      key={group.dateStr}
                      className={`rounded-2xl border transition-all shadow-md ${
                        isCurrentDay 
                          ? 'bg-black/40 backdrop-blur-xl border-white/20 shadow-black/20' 
                          : 'bg-black/40 backdrop-blur-xl border-white/10 hover:border-white/20'
                      } p-4 space-y-3`}
                    >
                      {/* Day Header Banner */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          {/* Date Block */}
                          <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 border ${
                            isCurrentDay 
                              ? 'bg-white text-black border-white/90 font-extrabold' 
                              : 'bg-white/5 text-white border-white/10'
                          }`}>
                            <span className="text-sm leading-none">{format(group.date, 'dd')}</span>
                            <span className="text-[9px] uppercase tracking-wider opacity-80 mt-0.5">T{format(group.date, 'MM')}</span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm md:text-base font-semibold text-white capitalize">
                                {format(group.date, 'EEEE', { locale: vi })}
                              </h3>
                              
                              {isCurrentDay && (
                                <span className="text-[10px] bg-white/10 text-white/80 border border-white/40 px-2 py-0.5 rounded-full font-semibold">
                                  Hôm nay
                                </span>
                              )}
                              {isTomorrowDay && (
                                <span className="text-[10px] bg-white/20 text-white/80 border border-white/40 px-2 py-0.5 rounded-full font-semibold">
                                  Ngày mai
                                </span>
                              )}
                              {isPast && (
                                <span className="text-[10px] bg-white/5 text-white/40 border border-white/10 px-2 py-0.5 rounded-full font-normal">
                                  Đã qua
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-white/40">
                              {format(group.date, 'dd/MM/yyyy')}
                            </p>
                          </div>
                        </div>

                        {/* Day Total Metrics */}
                        <div className="flex items-center gap-2">
                          {group.shifts.length > 0 && (
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-xl text-xs">
                              <span className="text-white/70 font-medium">{group.totalHours.toFixed(1)}h</span>
                              <span className="text-white/20">•</span>
                              <span className="font-semibold text-white/90">
                                {formatCurrency(group.totalPay, currency)}
                              </span>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setSelectedDate(group.date);
                              setIsDetailOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                            title="Xem chi tiết ngày"
                          >
                            Chi tiết
                          </button>
                        </div>
                      </div>

                      {/* Items List in this day */}
                      <div className="space-y-2 pt-1">
                        {/* Shifts */}
                        {group.shifts.map((shift) => {
                          const itemColor = shift.color || defaultShiftColor;
                          return (
                            <div
                              key={shift.id}
                              onClick={() => {
                                setSelectedDate(group.date);
                                setIsDetailOpen(true);
                              }}
                              className="group p-3 rounded-xl border border-white/5 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                            >
                              <div className="flex items-start sm:items-center gap-3">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-1 sm:mt-0 shadow-sm"
                                  style={{ backgroundColor: itemColor }}
                                />
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-white/90" />
                                      {shift.startTime} - {shift.endTime}
                                    </span>
                                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-white/70 border border-white/10 font-medium">
                                      {shift.hoursWorked.toFixed(1)} giờ
                                    </span>
                                    {((shift.holidayMultiplier && shift.holidayMultiplier > 1) || shift.isHoliday) && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold inline-flex items-center gap-0.5">
                                        <Flame className="w-2.5 h-2.5" />
                                        <span>x{shift.holidayMultiplier || 3}</span>
                                      </span>
                                    )}
                                    {shift.bonusHours && shift.bonusHours > 0 ? (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 border border-white/20">
                                        Đêm {shift.bonusHours.toFixed(1)}h
                                      </span>
                                    ) : null}
                                  </div>
                                  {shift.notes && (
                                    <p className="text-xs text-white/50 italic mt-1 line-clamp-1">
                                      "{shift.notes}"
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 pl-5 sm:pl-0 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                                <span className="text-xs text-white/40">
                                  {formatCurrency(shift.hourlyRate, currency)}/h
                                </span>
                                <span className="text-sm font-semibold text-white/90">
                                  +{formatCurrency(shift.totalPay, currency)}
                                </span>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingShift(shift);
                                    }}
                                    className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                                    title="Chỉnh sửa ca làm việc"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => handleSyncShiftToGoogle(shift, e)}
                                    disabled={isSyncingShiftId === shift.id}
                                    className="p-1.5 rounded-lg text-white/30 hover:text-white/90 hover:bg-white/90/10 transition-colors"
                                    title="Thêm ca làm này vào Google Calendar"
                                  >
                                    {isSyncingShiftId === shift.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white/90" />
                                    ) : (
                                      <CalendarPlus className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteShiftClick(shift.id, e)}
                                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                    title="Xóa ca làm việc này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Google Calendar Events */}
                        {group.googleEvents.map((evt, idx) => {
                          const raw = evt.rawGoogleEvent;
                          const isAllDay = evt.allDay;
                          const timeStr = isAllDay 
                            ? 'Cả ngày' 
                            : `${format(evt.start, 'HH:mm')} - ${format(evt.end, 'HH:mm')}`;
                          const eventColor = evt.color || raw?.computedColor || defaultGoogleColor;
                          const eventKey = evt.id || raw?.id;

                          return (
                            <div
                              key={evt.id || idx}
                              onClick={() => {
                                setSelectedDate(group.date);
                                setIsDetailOpen(true);
                              }}
                              className="p-3 rounded-xl border border-white/5 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                            >
                              <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-1 sm:mt-0 shadow-sm"
                                  style={{ backgroundColor: eventColor }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-white truncate">
                                      {evt.title}
                                    </span>
                                    <span 
                                      className="text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0"
                                      style={{
                                        backgroundColor: `${eventColor}20`,
                                        color: eventColor,
                                        border: `1px solid ${eventColor}40`
                                      }}
                                    >
                                      {timeStr}
                                    </span>
                                  </div>

                                  {raw?.location && (
                                    <div className="text-xs text-white/50 flex items-center gap-1.5 mt-1 truncate">
                                      <MapPin className="w-3 h-3 shrink-0 text-white/90" />
                                      <span className="truncate">{raw.location}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-2 pl-5 sm:pl-0">
                                {raw?.htmlLink && (
                                  <a
                                    href={raw.htmlLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 flex items-center gap-1 transition-colors"
                                  >
                                    <span>Xem trên Google</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}

                                {eventKey && (
                                  <button
                                    type="button"
                                    disabled={isDeletingEventId === eventKey}
                                    onClick={(e) => handleDeleteGoogleEvent(eventKey, evt.title, e)}
                                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50 transition-colors"
                                    title="Xóa sự kiện trên Google Calendar"
                                  >
                                    {isDeletingEventId === eventKey ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center bg-[#18181A] rounded-2xl border border-white/5 flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                    <CalendarDays className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Không có lịch trình nào</h4>
                    <p className="text-xs text-white/40 mt-1 max-w-sm">
                      {agendaSearch 
                        ? `Không tìm thấy kết quả phù hợp với từ khóa "${agendaSearch}".` 
                        : 'Không có ca làm việc hoặc sự kiện nào trong khoảng thời gian đã chọn.'}
                    </p>
                  </div>
                  {agendaSearch ? (
                    <button
                      onClick={() => setAgendaSearch('')}
                      className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-xl transition-colors"
                    >
                      Xóa tìm kiếm
                    </button>
                  ) : (
                    <button
                      onClick={() => setView('month')}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 border border-white/40 text-xs font-medium rounded-xl transition-colors"
                    >
                      Quay lại Lịch tháng
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* React Big Calendar Component with Smooth Custom Wheel & Scroll Navigation */
          <>
            {/* Custom styles to override react-big-calendar for a sleek, dark, simple & professional layout with customized scrollbars */}
            <style dangerouslySetInnerHTML={{__html: `
              .rbc-calendar { font-family: inherit; }
              .rbc-toolbar { display: none !important; } /* We use our modern React Toolbar above */
              
              /* Custom Calendar Scrollbar Styling */
              .custom-calendar-scroll::-webkit-scrollbar,
              .rbc-time-content::-webkit-scrollbar,
              .modal-scroll-body::-webkit-scrollbar {
                width: 8px;
                height: 8px;
              }
              .custom-calendar-scroll::-webkit-scrollbar-track,
              .rbc-time-content::-webkit-scrollbar-track,
              .modal-scroll-body::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.03);
                border-radius: 9999px;
              }
              .custom-calendar-scroll::-webkit-scrollbar-thumb,
              .rbc-time-content::-webkit-scrollbar-thumb,
              .modal-scroll-body::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.22);
                border-radius: 9999px;
                border: 2px solid rgba(18, 18, 20, 0.8);
                transition: all 0.2s ease;
              }
              .custom-calendar-scroll::-webkit-scrollbar-thumb:hover,
              .rbc-time-content::-webkit-scrollbar-thumb:hover,
              .modal-scroll-body::-webkit-scrollbar-thumb:hover {
                background: #10b981;
              }

              /* Overall Calendar Grid Container */
              .rbc-month-view, .rbc-time-view { 
                border: 1px solid rgba(255,255,255,0.08) !important; 
                border-radius: 20px; 
                overflow: hidden; 
                background: rgba(255,255,255,0.01); 
              }
              
              /* Headers (Thứ 2, Thứ 3, ...) */
              .rbc-header { 
                border-bottom: 1px solid rgba(255,255,255,0.08) !important; 
                border-left: 1px solid rgba(255,255,255,0.08) !important; 
                padding: 10px 0; 
                color: rgba(255,255,255,0.65); 
                font-weight: 600; 
                font-size: 0.8rem; 
                text-transform: capitalize; 
                background: rgba(255,255,255,0.03); 
              }
              .rbc-header:first-child { border-left: none !important; }
              
              /* Month Rows & Day Cells */
              .rbc-month-row { border-top: 1px solid rgba(255,255,255,0.06) !important; min-height: 100px; }
              .rbc-day-bg { border-left: 1px solid rgba(255,255,255,0.06) !important; cursor: pointer; transition: background-color 0.15s ease; }
              .rbc-day-bg:first-child { border-left: none !important; }
              .rbc-day-bg:hover { background-color: rgba(255,255,255,0.035); }
              .rbc-off-range-bg { background: rgba(0,0,0,0.25); }
              
              .rbc-date-cell { padding: 8px 10px; color: rgba(255,255,255,0.75); font-size: 0.825rem; font-weight: 500; cursor: pointer; text-align: right; }
              .rbc-date-cell.rbc-now { font-weight: 700; color: #10b981; }
              .rbc-off-range { color: rgba(255,255,255,0.2); }
              .rbc-today { background-color: rgba(16, 185, 129, 0.05) !important; }
              .rbc-row-content { cursor: pointer; }
              
              /* Event Pills */
              .rbc-event { 
                padding: 2px 7px !important; 
                font-size: 0.72rem !important; 
                font-weight: 500 !important; 
                margin-bottom: 2px !important; 
                border-radius: 6px !important; 
                white-space: nowrap; 
                overflow: hidden; 
                text-overflow: ellipsis; 
              }
              .rbc-event-content { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.35; }
              .rbc-row-segment { padding: 0 4px 2px 4px; }
              .rbc-show-more { color: #34d399 !important; font-size: 0.72rem; font-weight: 600; padding: 2px 4px; background: transparent !important; }
              
              /* Time View (Week & Day) with smooth custom scroll */
              .rbc-time-view { border-color: rgba(255,255,255,0.08) !important; }
              .rbc-time-header { border-bottom: 1px solid rgba(255,255,255,0.08) !important; }
              .rbc-time-content { 
                border-top: 1px solid rgba(255,255,255,0.08) !important; 
                overflow-y: auto !important; 
                scrollbar-gutter: stable;
                scroll-behavior: smooth;
              }
              .rbc-timeslot-group { border-bottom: 1px solid rgba(255,255,255,0.04) !important; min-height: 52px; }
              .rbc-time-header-content { border-left: 1px solid rgba(255,255,255,0.08) !important; }
              .rbc-day-slot .rbc-time-slot { border-top: 1px solid rgba(255,255,255,0.02) !important; }
              .rbc-time-gutter .rbc-timeslot-group { color: rgba(255,255,255,0.4); font-size: 0.75rem; border-color: rgba(255,255,255,0.04) !important; }
              .rbc-current-time-indicator { background-color: #10b981 !important; height: 2px; }
            `}} />
            
            {/* Scrollable container for mobile responsiveness and smooth desktop wheel interaction */}
            <div 
              onWheel={handleCalendarWheel}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="w-full overflow-x-auto overflow-y-visible custom-calendar-scroll pb-1 rounded-2xl flex-1 flex flex-col select-none"
            >
              <div className="min-w-[680px] lg:min-w-full h-full min-h-[540px] flex-1 flex flex-col overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${currentDate.getFullYear()}-${currentDate.getMonth()}-${view}`}
                    initial={{
                      opacity: 0.35,
                      y: slideDirection === 'next' ? 24 : slideDirection === 'prev' ? -24 : 0,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: {
                        duration: 0.22,
                        ease: [0.16, 1, 0.3, 1]
                      }
                    }}
                    exit={{
                      opacity: 0.15,
                      y: slideDirection === 'next' ? -24 : slideDirection === 'prev' ? 24 : 0,
                      transition: {
                        duration: 0.16,
                        ease: [0.16, 1, 0.3, 1]
                      }
                    }}
                    className="h-full min-h-[540px] flex-1 flex flex-col"
                  >
                    <Calendar
                      localizer={localizer}
                      events={displayedEvents}
                      startAccessor="start"
                      endAccessor="end"
                      allDayAccessor="allDay"
                      style={{ height: '100%', minHeight: '520px' }}
                      eventPropGetter={eventStyleGetter}
                      views={['month', 'week', 'day']}
                      view={view as any}
                      onView={(v: View) => setView(v)}
                      date={currentDate}
                      onNavigate={(newDate: Date) => setCurrentDate(newDate)}
                      messages={messages}
                      culture="vi"
                      selectable={true}
                      toolbar={false}
                      onSelectSlot={handleSelectSlot}
                      onSelectEvent={handleSelectEvent}
                      onDrillDown={handleDrillDown}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Clean Bottom Legend Bar */}
      <div className="mt-4 flex items-center justify-between flex-wrap gap-3 text-xs text-white/50 bg-[#161618] p-3 rounded-2xl border border-white/5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span 
              className="w-2.5 h-2.5 rounded-full shadow-sm" 
              style={{ backgroundColor: defaultShiftColor }}
            />
            <span className="font-medium text-white/80">Ca làm việc</span>
          </div>
          <div className="w-px h-3.5 bg-white/10"></div>
          <div className="flex items-center gap-2">
            <span 
              className="w-2.5 h-2.5 rounded-full shadow-sm" 
              style={{ backgroundColor: defaultGoogleColor }}
            />
            <span className="font-medium text-white/80">Google Calendar</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-white/40">
          {view === 'month' ? (
            <span className="flex items-center gap-1.5 text-white/90/80 font-medium">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Cuộn lên / xuống để chuyển tháng mượt mà
            </span>
          ) : (
            <span>Nhấp vào sự kiện hoặc thẻ ngày để xem chi tiết</span>
          )}
        </div>
      </div>

      {/* Day Details Modal */}
      {isDetailOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="bg-[#18181B] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/90">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white capitalize">
                    {format(selectedDate, 'EEEE, dd/MM/yyyy', { locale: vi })}
                  </h3>
                  <p className="text-xs text-white/40">
                    Chi tiết ca làm & sự kiện trong ngày
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 modal-scroll-body">
              {/* Daily Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5">
                  <div className="text-xs text-white/40 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-white/90" />
                    <span>Tổng giờ làm</span>
                  </div>
                  <div className="text-xl font-semibold text-white tracking-tight">
                    {selectedDateDetails.totalHours.toFixed(1)} <span className="text-xs text-white/40 font-normal">giờ</span>
                  </div>
                </div>

                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5">
                  <div className="text-xs text-white/40 mb-1 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-white/90" />
                    <span>Dự tính lương</span>
                  </div>
                  <div className="text-xl font-semibold text-white/90 tracking-tight">
                    {formatCurrency(selectedDateDetails.totalPay, currency)}
                  </div>
                </div>
              </div>

              {/* Shifts Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-white/90" />
                    <span>Ca làm việc ({selectedDateDetails.dayShifts.length})</span>
                  </h4>
                  {onAddShift && selectedDate && (
                    <button
                      type="button"
                      onClick={() => {
                        const dateStr = format(selectedDate, 'yyyy-MM-dd');
                        const newShift: Shift = {
                          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `shift_${Date.now()}`,
                          date: dateStr,
                          startTime: '08:00',
                          endTime: '12:00',
                          hourlyRate: settings?.defaultHourlyRate || 30000,
                          hoursWorked: 4,
                          totalPay: (settings?.defaultHourlyRate || 30000) * 4,
                          createdAt: new Date().toISOString(),
                          color: settings?.shiftColor || '#10b981'
                        };
                        setEditingShift(newShift);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm ca</span>
                    </button>
                  )}
                </div>

                {selectedDateDetails.dayShifts.length > 0 ? (
                  <div className="space-y-2.5">
                    {selectedDateDetails.dayShifts.map((shift) => {
                      const itemColor = shift.color || defaultShiftColor;
                      return (
                        <div 
                          key={shift.id}
                          className="border rounded-2xl p-4 space-y-2 transition-all shadow-sm"
                          style={{
                            backgroundColor: `${itemColor}12`,
                            borderColor: `${itemColor}40`
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-medium text-white text-sm">
                              <span 
                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" 
                                style={{ backgroundColor: itemColor }}
                              />
                              <Clock className="w-4 h-4 text-white/70" />
                              <span>{shift.startTime} - {shift.endTime}</span>
                              <span 
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  backgroundColor: `${itemColor}30`,
                                  color: 'white',
                                  border: `1px solid ${itemColor}50`
                                }}
                              >
                                {shift.hoursWorked.toFixed(1)}h
                              </span>
                              {((shift.holidayMultiplier && shift.holidayMultiplier > 1) || shift.isHoliday) && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold inline-flex items-center gap-1">
                                  <Flame className="w-3 h-3" />
                                  <span>{shift.holidayName || `Lễ x${shift.holidayMultiplier || 3}`}</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white/90 text-sm mr-1">
                                {formatCurrency(shift.totalPay, currency)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingShift(shift);
                                }}
                                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                title="Chỉnh sửa ca làm việc này"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleSyncShiftToGoogle(shift, e)}
                                disabled={isSyncingShiftId === shift.id}
                                className="p-1.5 rounded-lg text-white/40 hover:text-white/90 hover:bg-white/90/10 transition-colors"
                                title="Thêm ca làm này vào Google Calendar"
                              >
                                {isSyncingShiftId === shift.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white/90" />
                                ) : (
                                  <CalendarPlus className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteShiftClick(shift.id, e)}
                                className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                title="Xóa ca làm việc này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="text-xs text-white/50 flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 border-t border-white/5">
                            <div>Lương: <span className="text-white/80">{formatCurrency(shift.hourlyRate, currency)}/h</span></div>
                            {shift.bonusHours && shift.bonusHours > 0 ? (
                              <div>Giờ đêm: <span className="text-white/60">{shift.bonusHours.toFixed(1)}h</span></div>
                            ) : null}
                            {shift.notes && (
                              <div className="w-full text-white/60 italic mt-0.5">
                                "{shift.notes}"
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-white/40 italic p-3 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                    Không có ca làm việc nào trong ngày này.
                  </div>
                )}
              </div>

              {/* Google Events Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
                    <CalendarIcon className="w-3.5 h-3.5 text-white/90" />
                    <span>Lịch học & Sự kiện Google ({selectedDateDetails.dayGoogleEvents.length})</span>
                  </h4>
                </div>

                {selectedDateDetails.dayGoogleEvents.length > 0 ? (
                  <div className="space-y-2.5">
                    {selectedDateDetails.dayGoogleEvents.map((evt, idx) => {
                      const raw = evt.rawGoogleEvent;
                      const isAllDay = evt.allDay;
                      const timeStr = isAllDay 
                        ? 'Cả ngày' 
                        : `${format(evt.start, 'HH:mm')} - ${format(evt.end, 'HH:mm')}`;
                      const eventColor = evt.color || raw?.computedColor || defaultGoogleColor;
                      const eventKey = evt.id || raw?.id;

                      return (
                        <div 
                          key={evt.id || idx}
                          className="border rounded-2xl p-4 space-y-2 transition-all shadow-sm"
                          style={{
                            backgroundColor: `${eventColor}15`,
                            borderColor: `${eventColor}45`
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-white text-sm flex items-center gap-2">
                              <span 
                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" 
                                style={{ backgroundColor: eventColor }}
                              />
                              <span>{evt.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span 
                                className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                                style={{
                                  backgroundColor: `${eventColor}30`,
                                  color: 'white',
                                  border: `1px solid ${eventColor}50`
                                }}
                              >
                                {timeStr}
                              </span>

                              {eventKey && (
                                <button
                                  type="button"
                                  disabled={isDeletingEventId === eventKey}
                                  onClick={(e) => handleDeleteGoogleEvent(eventKey, evt.title, e)}
                                  className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50 transition-colors"
                                  title="Xóa sự kiện trên Google Calendar"
                                >
                                  {isDeletingEventId === eventKey ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {raw?.location && (
                            <div className="text-xs text-white/70 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: eventColor }} />
                              <span className="truncate">{raw.location}</span>
                            </div>
                          )}

                          {raw?.description && (
                            <div className="text-xs text-white/60 pt-1 border-t border-white/5 whitespace-pre-wrap">
                              {raw.description}
                            </div>
                          )}

                          {raw?.htmlLink && (
                            <div className="pt-1">
                              <a
                                href={raw.htmlLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] hover:underline transition-colors"
                                style={{ color: eventColor }}
                              >
                                <span>Xem trên Google Calendar</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-white/40 italic p-3 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                    {isConnected 
                      ? 'Không có sự kiện Google Calendar nào trong ngày này.'
                      : 'Chưa kết nối Google Calendar để xem lịch học/sự kiện.'}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/5 bg-white/[0.02] flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Shift Modal */}
      <AnimatePresence>
        {editingShift && (
          <EditShiftModal
            shift={editingShift}
            settings={settings || {
              defaultHourlyRate: 30000,
              nightShiftBonusType: 'percent',
              nightShiftBonusValue: 30,
              nightShiftBonusPercent: 30,
              currency: 'VND',
              shiftTemplates: [],
              expenseCategories: [],
              accounts: [],
              shiftColor: '#10b981',
              googleEventColor: '#3b82f6',
              autoSyncGoogleCalendar: false,
              defaultHolidayMultiplier: 3,
              autoDetectHolidays: true,
              updatedAt: new Date().toISOString()
            }}
            onClose={() => setEditingShift(null)}
            onSave={(updatedShift, syncToGoogle) => {
              const exists = shifts.some(s => s.id === updatedShift.id);
              if (exists) {
                onUpdateShift?.(updatedShift);
                if (syncToGoogle) {
                  if (hasAccessToken()) {
                    addShiftToCalendar(updatedShift, settings?.currency).catch(err => {
                      console.error("Failed to sync edited shift:", err);
                    });
                  } else {
                    try {
                      requestAccessToken();
                    } catch (err) {}
                  }
                }
              } else {
                onAddShift?.(updatedShift, syncToGoogle);
              }
              setEditingShift(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


