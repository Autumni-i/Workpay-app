import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import ShiftList from './components/ShiftList';
import ShiftForm from './components/ShiftForm';
import WorkspaceActions from './components/WorkspaceActions';
import Sidebar from './components/Sidebar';
import { formatCurrency } from './lib/utils';
import { useAuth } from './lib/AuthContext';
import { useFirebaseData } from './lib/useFirebaseData';
import { initGoogleIdentity, addShiftToCalendar, hasAccessToken, requestAccessToken } from './lib/workspace';
import { Menu, Loader2, Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Shift } from './types';

// Lazy load heavy components for optimized RAM and instant page load
const MoneyManager = lazy(() => import('./components/MoneyManager'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const ShiftsCharts = lazy(() => import('./components/ShiftsCharts'));
const AuthModal = lazy(() => import('./components/AuthModal'));
const CalendarView = lazy(() => import('./components/CalendarView'));

const ComponentLoader = () => (
  <div className="flex items-center justify-center p-12 text-white/40">
    <Loader2 className="w-6 h-6 animate-spin" />
  </div>
);

export default function App() {
  const { user, logout } = useAuth();
  const {
    shifts,
    transactions,
    settings,
    syncStatus,
    lastSyncTime,
    syncErrorMessage,
    manualSync,
    addShift,
    updateShift,
    deleteShift,
    addTransaction,
    deleteTransaction,
    updateSettings
  } = useFirebaseData();

  const [activeTab, setActiveTab] = useState<'shifts' | 'money' | 'calendar'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('workpay_activeTab');
      if (saved === 'money' || saved === 'shifts' || saved === 'calendar') return saved;
    }
    return 'shifts';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('workpay_activeTab', activeTab);
  }, [activeTab]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const currentPayrollMonth = useMemo(() => {
    const today = new Date();
    const cutoff = settings.payrollCutoffDate;
    if (cutoff && cutoff >= 1 && cutoff <= 31) {
      if (today.getDate() > cutoff) {
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        return format(nextMonth, 'yyyy-MM');
      }
    }
    return format(today, 'yyyy-MM');
  }, [settings.payrollCutoffDate]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    shifts.forEach(s => months.add(s.date.substring(0, 7)));
    const sorted = Array.from(months).sort().reverse();
    if (!sorted.includes(currentPayrollMonth)) {
      sorted.unshift(currentPayrollMonth);
    }
    // Also ensure regular current month is in there if it's not the same
    const currentCalendarMonth = format(new Date(), 'yyyy-MM');
    if (!sorted.includes(currentCalendarMonth)) {
        // Just keeping it simple
    }
    return sorted;
  }, [shifts, currentPayrollMonth]);

  const [selectedOverviewMonth, setSelectedOverviewMonth] = useState<string>(() => {
    return format(new Date(), 'yyyy-MM');
  });

  // Track if user manually changed the dropdown
  const [userSelectedOverview, setUserSelectedOverview] = useState(false);

  useEffect(() => {
    if (!userSelectedOverview) {
      setSelectedOverviewMonth(currentPayrollMonth);
    }
  }, [currentPayrollMonth, userSelectedOverview]);

  const overviewCycle = useMemo(() => {
    if (selectedOverviewMonth === 'all') return null;
    const [year, month] = selectedOverviewMonth.split('-').map(Number);
    const cutoff = settings.payrollCutoffDate;
    
    if (cutoff && cutoff >= 1 && cutoff <= 31) {
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const actualCutoff = Math.min(cutoff, lastDayOfMonth);
      
      const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
      const actualPrevCutoff = Math.min(cutoff, prevMonthLastDay);
      
      const start = new Date(year, month - 2, actualPrevCutoff + 1, 0, 0, 0, 0);
      const end = new Date(year, month - 1, actualCutoff, 23, 59, 59, 999);
      return { start, end };
    }
    
    return {
      start: new Date(year, month - 1, 1, 0, 0, 0, 0),
      end: new Date(year, month, 0, 23, 59, 59, 999)
    };
  }, [selectedOverviewMonth, settings.payrollCutoffDate]);

  const filteredOverviewShifts = useMemo(() => {
    if (selectedOverviewMonth === 'all') return shifts;
    if (overviewCycle) {
      return shifts.filter(s => {
        const d = new Date(s.date + 'T12:00:00');
        return d >= overviewCycle.start && d <= overviewCycle.end;
      });
    }
    return shifts.filter(s => s.date.startsWith(selectedOverviewMonth));
  }, [shifts, selectedOverviewMonth, overviewCycle]);

  const overviewWorkingDays = useMemo(() => {
    const uniqueDays = new Set(filteredOverviewShifts.map(s => s.date));
    return uniqueDays.size;
  }, [filteredOverviewShifts]);

  const overviewTotalShifts = filteredOverviewShifts.length;
  const overviewTotalHours = filteredOverviewShifts.reduce((sum, s) => sum + s.hoursWorked, 0);
  const overviewTotalPay = filteredOverviewShifts.reduce((sum, s) => sum + s.totalPay, 0);
  const overviewAvgPay = overviewTotalHours > 0 ? overviewTotalPay / overviewTotalHours : 0;

  useEffect(() => {
    initGoogleIdentity();
  }, []);

  const handleAddShift = async (shift: Shift, syncToGoogle?: boolean) => {
    addShift(shift);
    
    const shouldSync = syncToGoogle !== undefined 
      ? syncToGoogle 
      : (settings.autoSyncGoogleCalendar ?? false);

    if (shouldSync) {
      if (hasAccessToken()) {
        try {
          await addShiftToCalendar(shift, settings.currency);
        } catch (err: any) {
          console.error("Failed to sync shift to calendar:", err);
          if (err.message && err.message.includes('Phiên kết nối')) {
            alert(err.message);
          }
        }
      } else if (syncToGoogle === true) {
        // If user explicitly checked the box but is not logged in to Google yet
        try {
          requestAccessToken();
        } catch (err) {
          console.error("Failed to request Google access:", err);
        }
      }
    }
  };

  const handleDeleteShift = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa ca làm này không?')) {
      deleteShift(id);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa giao dịch này không?')) {
      deleteTransaction(id);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-[#f1f1f1] font-sans overflow-hidden relative">
      
      {/* Cạnh trái để hover mở sidebar */}
      <div 
        className="fixed inset-y-0 left-0 w-4 z-40 cursor-pointer hidden md:block"
        onMouseEnter={() => setIsSidebarOpen(true)}
      />

      <Sidebar 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        logout={logout}
        onLoginClick={() => setIsAuthModalOpen(true)}
        onSettingsClick={() => setIsSettingsOpen(true)}
        syncStatus={syncStatus}
        lastSyncTime={lastSyncTime}
        manualSync={manualSync}
      />

      <AnimatePresence>
        {isAuthModalOpen && (
          <Suspense fallback={null}>
            <AuthModal onClose={() => setIsAuthModalOpen(false)} />
          </Suspense>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {isSettingsOpen && (
          <Suspense fallback={null}>
            <SettingsModal 
              settings={settings}
              onClose={() => setIsSettingsOpen(false)}
              onSave={(newSettings) => {
                updateSettings(newSettings);
                setIsSettingsOpen(false);
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.02] backdrop-blur-3xl">
          <div className="flex items-center">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-white/80 hover:text-white rounded-lg transition-colors focus:outline-none"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-2 font-semibold text-lg">WorkPay</span>
          </div>

          {/* Sync Status Badge in Header */}
          <div className="flex items-center gap-2">
            {user ? (
              <div 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-all ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : syncStatus === 'syncing'
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : syncStatus === 'error'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                {syncStatus === 'syncing' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="hidden sm:inline font-medium">Đang đồng bộ...</span>
                  </>
                ) : syncStatus === 'synced' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <Cloud className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline font-medium">Đã đồng bộ</span>
                  </>
                ) : syncStatus === 'error' ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline font-medium">{syncErrorMessage || 'Lỗi đồng bộ'}</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline font-medium">Lưu máy</span>
                  </>
                )}

                <button
                  onClick={manualSync}
                  disabled={syncStatus === 'syncing'}
                  className="p-1 -mr-1 hover:bg-white/10 rounded-full transition-colors"
                  title="Đồng bộ ngay với đám mây"
                >
                  <RefreshCw className={`w-3 h-3 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white/70 transition-colors"
                title="Đăng nhập để đồng bộ dữ liệu đa thiết bị"
              >
                <CloudOff className="w-3.5 h-3.5 text-white/40" />
                <span className="hidden sm:inline">Chế độ Khách</span>
                <span className="text-white font-medium ml-1">Đăng nhập</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-[1400px] mx-auto w-full h-full">
            <AnimatePresence mode="wait">
              {activeTab === 'shifts' && (
                <motion.div 
                  key="shifts"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col lg:flex-row gap-8 w-full pb-8"
                >
                  <section className="w-full lg:w-1/3 flex flex-col gap-6">
                    {/* Overview Card */}
                    <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl p-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] space-y-6">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest">Tổng quan</h2>
                        <select
                          value={selectedOverviewMonth}
                          onChange={(e) => {
                            setSelectedOverviewMonth(e.target.value);
                            setUserSelectedOverview(true);
                          }}
                          className="bg-[#1C1C1E] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:border-white/30 [color-scheme:dark]"
                        >
                          <option value="all">Tất cả thời gian</option>
                          {availableMonths.map((m) => {
                            const [y, mo] = m.split('-');
                            return (
                              <option key={m} value={m}>
                                Tháng {mo}/{y}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <div className="text-4xl font-light text-white mb-1 tracking-tight">
                          {formatCurrency(overviewTotalPay, settings.currency).replace(/₫|VND/g, '').trim()}
                          <span className="text-lg text-white/90 font-medium ml-2">{settings.currency}</span>
                        </div>
                        <div className="text-xs text-white/40">
                          {selectedOverviewMonth === 'all'
                            ? 'Tổng thu nhập (Tất cả ca làm)'
                            : settings.payrollCutoffDate && overviewCycle 
                                ? `Chu kỳ lương: ${format(overviewCycle.start, 'dd/MM')} - ${format(overviewCycle.end, 'dd/MM')}`
                                : `Dự tính lương tháng ${selectedOverviewMonth.split('-')[1]}/${selectedOverviewMonth.split('-')[0]}`}
                        </div>
                        {selectedOverviewMonth !== 'all' && settings.payrollCutoffDate && settings.paydayDate && overviewCycle && (
                           <div className="text-[11px] text-white/50 mt-2 px-2.5 py-1.5 bg-white/[0.03] rounded-lg border border-white/5 inline-flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" />
                             Nhận lương dự kiến: <strong className="text-white/80">{String(settings.paydayDate).padStart(2, '0')}/{format(new Date(overviewCycle.end.getFullYear(), overviewCycle.end.getMonth() + 1, 1), 'MM/yyyy')}</strong>
                           </div>
                        )}
                      </div>

                      {/* Detailed Metrics Grid */}
                      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                        {/* Total Working Days */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between">
                          <div className="text-2xl font-semibold text-white tracking-tight">
                            {overviewWorkingDays} <span className="text-xs text-white/40 font-normal uppercase">ngày</span>
                          </div>
                          <div className="text-xs text-white/40 mt-1">
                            Số ngày làm {overviewTotalShifts > 0 && `(${overviewTotalShifts} ca)`}
                          </div>
                        </div>

                        {/* Total Hours */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between">
                          <div className="text-2xl font-semibold text-white tracking-tight">
                            {overviewTotalHours.toFixed(1)} <span className="text-xs text-white/40 font-normal uppercase">giờ</span>
                          </div>
                          <div className="text-xs text-white/40 mt-1">Tổng giờ làm</div>
                        </div>

                        {/* Average Pay per hour */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between">
                          <div className="text-lg font-semibold text-white tracking-tight">
                            {formatCurrency(overviewAvgPay, settings.currency).replace(/₫|VND/g, '').trim()}
                            <span className="text-xs text-white/40 font-normal uppercase"> /h</span>
                          </div>
                          <div className="text-xs text-white/40 mt-1">Lương TB / giờ</div>
                        </div>

                        {/* Average Hours per day */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between">
                          <div className="text-lg font-semibold text-white tracking-tight">
                            {overviewWorkingDays > 0 ? (overviewTotalHours / overviewWorkingDays).toFixed(1) : '0.0'}
                            <span className="text-xs text-white/40 font-normal uppercase"> h/ngày</span>
                          </div>
                          <div className="text-xs text-white/40 mt-1">TB giờ / ngày</div>
                        </div>
                      </div>

                      {/* Monthly working days breakdown if multiple months exist */}
                      {availableMonths.length > 1 && (
                        <div className="pt-4 border-t border-white/5 space-y-2">
                          <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                            Số ngày làm theo từng tháng
                          </div>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                            {availableMonths.map((m) => {
                              const [yr, mo] = m.split('-');
                              const year = Number(yr);
                              const month = Number(mo);
                              
                              let mStart: Date | null = null;
                              let mEnd: Date | null = null;
                              
                              if (settings.payrollCutoffDate && settings.payrollCutoffDate >= 1 && settings.payrollCutoffDate <= 31) {
                                const lastDayOfMonth = new Date(year, month, 0).getDate();
                                const actualCutoff = Math.min(settings.payrollCutoffDate, lastDayOfMonth);
                                const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
                                const actualPrevCutoff = Math.min(settings.payrollCutoffDate, prevMonthLastDay);
                                mStart = new Date(year, month - 2, actualPrevCutoff + 1, 0, 0, 0, 0);
                                mEnd = new Date(year, month - 1, actualCutoff, 23, 59, 59, 999);
                              }
                              
                              const mShifts = shifts.filter(s => {
                                if (!mStart || !mEnd) return s.date.startsWith(m);
                                const d = new Date(s.date + 'T12:00:00');
                                return d >= mStart && d <= mEnd;
                              });

                              const mDays = new Set(mShifts.map(s => s.date)).size;
                              const mHours = mShifts.reduce((sum, s) => sum + s.hoursWorked, 0);
                              const mPay = mShifts.reduce((sum, s) => sum + s.totalPay, 0);
                              const isSelected = selectedOverviewMonth === m;

                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => {
                                    setSelectedOverviewMonth(m);
                                    setUserSelectedOverview(true);
                                  }}
                                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-all ${
                                    isSelected 
                                      ? 'bg-white/5 border border-white/20 text-white/80' 
                                      : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 text-white/70'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">Tháng {mo}/{yr}</span>
                                    <span className="text-[10px] text-white/90 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-medium">
                                      {mDays} ngày làm
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-white">
                                      {formatCurrency(mPay, settings.currency)}
                                    </div>
                                    <div className="text-[10px] text-white/40">
                                      {mHours.toFixed(1)}h ({mShifts.length} ca)
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <ShiftForm onAdd={handleAddShift} settings={settings} shifts={shifts} />
                  </section>
                  
                  <section className="flex-1 flex flex-col min-w-0 gap-6">
                    <ShiftList 
                      shifts={shifts} 
                      onDelete={handleDeleteShift} 
                      onUpdate={updateShift}
                      settings={settings}
                    />
                    <WorkspaceActions shifts={shifts} />
                    <Suspense fallback={<ComponentLoader />}>
                      <ShiftsCharts shifts={shifts} currency={settings.currency} settings={settings} />
                    </Suspense>
                  </section>
                </motion.div>
              )}

              {activeTab === 'money' && (
                <motion.div
                  key="money"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Suspense fallback={<ComponentLoader />}>
                    <MoneyManager 
                      shifts={shifts} 
                      transactions={transactions}
                      onAddTransaction={addTransaction}
                      onDeleteTransaction={handleDeleteTransaction}
                      settings={settings}
                    />
                  </Suspense>
                </motion.div>
              )}

              {activeTab === 'calendar' && (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <Suspense fallback={<ComponentLoader />}>
                    <CalendarView 
                      shifts={shifts} 
                      settings={settings} 
                      onDeleteShift={handleDeleteShift}
                      onUpdateShift={updateShift}
                      onAddShift={handleAddShift}
                    />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
