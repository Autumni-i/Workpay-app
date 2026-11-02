import { useState, useEffect, FormEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { UserSettings, ShiftTemplate, NightBonusType } from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Percent, 
  DollarSign, 
  Palette, 
  Sparkles, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  ExternalLink,
  Flame,
  Moon,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { hasAccessToken, requestAccessToken } from '../lib/workspace';
import ColorPicker from './ColorPicker';

interface SettingsModalProps {
  settings: UserSettings;
  onClose: () => void;
  onSave: (settings: UserSettings) => void;
}

export default function SettingsModal({ settings, onClose, onSave }: SettingsModalProps) {
  const [payrollCutoffDate, setPayrollCutoffDate] = useState<string>(settings.payrollCutoffDate?.toString() || '');
  const [paydayDate, setPaydayDate] = useState<string>(settings.paydayDate?.toString() || '');
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(settings.defaultHourlyRate.toString());
  const [nightShiftBonusType, setNightShiftBonusType] = useState<NightBonusType>(
    settings.nightShiftBonusType || 'percent'
  );
  const [nightShiftBonusValue, setNightShiftBonusValue] = useState(
    (settings.nightShiftBonusValue !== undefined
      ? settings.nightShiftBonusValue
      : (settings.nightShiftBonusPercent ?? 30)
    ).toString()
  );
  const [defaultHolidayMultiplier, setDefaultHolidayMultiplier] = useState<number>(
    settings.defaultHolidayMultiplier ?? 3
  );
  const [autoDetectHolidays, setAutoDetectHolidays] = useState<boolean>(
    settings.autoDetectHolidays ?? true
  );
  const [currency, setCurrency] = useState(settings.currency);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>(settings.shiftTemplates || []);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(
    settings.expenseCategories || ['Tiền ăn', 'Di chuyển', 'Khác']
  );
  const [accounts, setAccounts] = useState<string[]>(
    settings.accounts || ['Tiền mặt', 'Momo']
  );
  const [shiftColor, setShiftColor] = useState(settings.shiftColor || '#10b981');
  const [autoSyncGoogleCalendar, setAutoSyncGoogleCalendar] = useState<boolean>(
    settings.autoSyncGoogleCalendar ?? false
  );
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(hasAccessToken());

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

  const handleConnectGoogle = () => {
    try {
      requestAccessToken();
    } catch (err: any) {
      alert(err.message || 'Không thể mở xác thực Google');
    }
  };

  const [newCategory, setNewCategory] = useState('');
  const [newAccount, setNewAccount] = useState('');

  const handleAddTemplate = () => {
    setShiftTemplates([
      ...shiftTemplates, 
      { 
        id: uuidv4(), 
        name: 'Ca mới', 
        startTime: '09:00', 
        endTime: '18:00',
        color: shiftColor 
      }
    ]);
  };

  const handleUpdateTemplate = (id: string, field: keyof ShiftTemplate, value: string) => {
    setShiftTemplates(shiftTemplates.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleRemoveTemplate = (id: string) => {
    setShiftTemplates(shiftTemplates.filter(t => t.id !== id));
  };

  const handleAddCategory = () => {
    if (newCategory.trim() && !expenseCategories.includes(newCategory.trim())) {
      setExpenseCategories([...expenseCategories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (cat: string) => {
    setExpenseCategories(expenseCategories.filter(c => c !== cat));
  };

  const handleAddAccount = () => {
    if (newAccount.trim() && !accounts.includes(newAccount.trim())) {
      setAccounts([...accounts, newAccount.trim()]);
      setNewAccount('');
    }
  };

  const handleRemoveAccount = (acc: string) => {
    setAccounts(accounts.filter(a => a !== acc));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedBonusValue = parseFloat(nightShiftBonusValue) || 0;
    onSave({
      ...settings,
      payrollCutoffDate: payrollCutoffDate ? parseInt(payrollCutoffDate) : undefined,
      paydayDate: paydayDate ? parseInt(paydayDate) : undefined,
      defaultHourlyRate: parseFloat(defaultHourlyRate) || 0,
      nightShiftBonusType,
      nightShiftBonusValue: parsedBonusValue,
      nightShiftBonusPercent: nightShiftBonusType === 'percent' ? parsedBonusValue : 0,
      defaultHolidayMultiplier,
      autoDetectHolidays,
      currency,
      shiftTemplates,
      expenseCategories,
      accounts,
      shiftColor,
      autoSyncGoogleCalendar
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", duration: 0.4, bounce: 0 }}
        className="relative z-10 bg-[#121214] border border-white/10 rounded-2xl w-full max-w-2xl my-auto max-h-[85vh] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 bg-[#121214] shrink-0 z-10">
          <h3 className="text-[15px] font-semibold text-white flex items-center gap-2">
            Cài đặt ứng dụng
          </h3>
          <button onClick={onClose} className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">
          
          {/* Group 1: General */}
          <section>
            <h4 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 px-2">Cơ bản</h4>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl divide-y divide-white/5">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white/90">Lương mặc định / giờ</div>
                  <div className="text-[11px] text-white/40 mt-0.5">Mức lương chuẩn áp dụng cho ca làm mới</div>
                </div>
                <div className="flex items-center gap-2 relative">
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={defaultHourlyRate}
                    onChange={(e) => setDefaultHourlyRate(e.target.value)}
                    className="w-full sm:w-32 bg-black/40 border border-white/10 rounded-xl pl-3 pr-10 py-2.5 text-sm text-right focus:outline-none focus:border-white/30 text-white transition-colors"
                  />
                  <span className="absolute right-3 text-xs font-medium text-white/40 pointer-events-none">{currency}</span>
                </div>
              </div>
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white/90">Đơn vị tiền tệ</div>
                  <div className="text-[11px] text-white/40 mt-0.5">Đơn vị hiển thị trên toàn ứng dụng</div>
                </div>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full sm:w-32 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-white/30 text-white appearance-none transition-colors"
                >
                  <option value="VND">VND (₫)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Group 2: Advanced Salary */}
          <section>
            <h4 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 px-2">Tính lương nâng cao</h4>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl divide-y divide-white/5">
              
              {/* Payroll Cycle */}
              <div className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-sm font-medium text-white/90">Chu kỳ lương</div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/60">Ngày chốt công (Hàng tháng)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="VD: 25 (để trống: cuối tháng)"
                        value={payrollCutoffDate}
                        onChange={(e) => setPayrollCutoffDate(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-white/30 text-white transition-colors"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/60">Ngày phát lương (Tháng sau)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="VD: 5"
                        value={paydayDate}
                        onChange={(e) => setPaydayDate(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-white/30 text-white transition-colors"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Thiết lập chu kỳ để báo cáo hiển thị chính xác. Ví dụ chốt công ngày 25, hệ thống sẽ tính lương từ 26 tháng trước đến 25 tháng này.
                </p>
              </div>

              {/* Holiday */}
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-400" />
                  <div className="text-sm font-medium text-white/90">Lương Ngày Lễ / Tết</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs text-white/60">Hệ số mặc định</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1.5, 2, 3, 4].map((mult) => (
                        <button
                          key={mult}
                          type="button"
                          onClick={() => setDefaultHolidayMultiplier(mult)}
                          className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                            defaultHolidayMultiplier === mult
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                              : 'bg-black/40 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          x{mult} {mult === 4 ? 'Tết' : mult === 3 ? 'Lễ' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-black/20 border border-white/5 rounded-xl self-end h-[50px]">
                    <div>
                      <div className="text-xs font-medium text-white/90">Tự động nhận diện Lễ</div>
                      <div className="text-[10px] text-white/40 mt-0.5">Luật lao động VN</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoDetectHolidays}
                      onClick={() => setAutoDetectHolidays(!autoDetectHolidays)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        autoDetectHolidays ? 'bg-rose-500' : 'bg-white/15'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          autoDetectHolidays ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Night Shift */}
              <div className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="text-sm font-medium text-white/90">Lương ca đêm (22h - 6h)</div>
                    </div>
                  </div>
                  <div className="inline-flex bg-black/40 p-1 rounded-xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => setNightShiftBonusType('percent')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        nightShiftBonusType === 'percent'
                          ? 'bg-white/10 text-white shadow-sm'
                          : 'text-white/40 hover:text-white/80'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5" />
                      <span>Theo %</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNightShiftBonusType('fixed')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        nightShiftBonusType === 'fixed'
                          ? 'bg-white/10 text-white shadow-sm'
                          : 'text-white/40 hover:text-white/80'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Cố định</span>
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="relative w-full sm:w-48">
                    <input
                      type="number"
                      required
                      min="0"
                      max={nightShiftBonusType === 'percent' ? 500 : undefined}
                      step={nightShiftBonusType === 'percent' ? '1' : 'any'}
                      placeholder={nightShiftBonusType === 'percent' ? '130' : '40000'}
                      value={nightShiftBonusValue}
                      onChange={(e) => setNightShiftBonusValue(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-3 pr-12 py-2.5 text-sm focus:outline-none focus:border-white/30 text-white transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-white/40 pointer-events-none">
                      {nightShiftBonusType === 'percent' ? '%' : `${currency}/h`}
                    </div>
                  </div>
                  <p className="text-[11px] text-white/40 leading-relaxed flex-1">
                    {nightShiftBonusType === 'percent'
                      ? 'VD: Đặt 130%, lương cơ bản 30k/h thì lương ca đêm là 39k/h.'
                      : `VD: Lương ca đêm được cố định ở mức ${nightShiftBonusValue ? formatCurrency(parseFloat(nightShiftBonusValue) || 0, currency) : '40.000đ'}/giờ.`}
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* Group 3: Display & Sync */}
          <section>
            <h4 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 px-2">Lịch & Đồng bộ</h4>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl divide-y divide-white/5">
              
              {/* Color Settings */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-white/90">Màu sắc mặc định</div>
                  <div className="text-[11px] text-white/40 mt-0.5">Sử dụng trên Lịch Workpay</div>
                </div>
                <div className="shrink-0 w-full sm:w-auto">
                  <ColorPicker
                    value={shiftColor}
                    onChange={setShiftColor}
                  />
                </div>
              </div>

              {/* Google Sync */}
              <div className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-emerald-400" />
                    <div className="text-sm font-medium text-white/90">Google Calendar</div>
                  </div>
                  <div>
                    {isGoogleConnected ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Đã kết nối
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectGoogle}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Liên kết tài khoản
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 bg-black/20 p-3 rounded-xl border border-white/5">
                  <div>
                    <div className="text-xs font-medium text-white/90">Tự động đồng bộ ca mới</div>
                    <div className="text-[11px] text-white/40 mt-0.5">Tạo sự kiện tương ứng trên Google Calendar</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoSyncGoogleCalendar}
                    onClick={() => {
                      const nextState = !autoSyncGoogleCalendar;
                      setAutoSyncGoogleCalendar(nextState);
                      if (nextState && !isGoogleConnected) {
                        handleConnectGoogle();
                      }
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      autoSyncGoogleCalendar ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-white/15'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        autoSyncGoogleCalendar ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Group 4: Templates & Categories */}
          <section>
            <h4 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 px-2">Dữ liệu mẫu</h4>
            
            <div className="space-y-4">
              {/* Shift Templates */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-medium text-white/90">Mẫu ca làm việc</div>
                    <div className="text-[11px] text-white/40">Tạo sẵn để chọn nhanh khi thêm ca</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTemplate}
                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                {shiftTemplates.length === 0 ? (
                  <p className="text-[11px] text-white/30 text-center py-4 bg-black/20 rounded-xl border border-white/5">Chưa có mẫu nào</p>
                ) : (
                  <div className="space-y-2">
                    {shiftTemplates.map((template) => (
                      <div key={template.id} className="flex flex-wrap md:flex-nowrap items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/5">
                        <ColorPicker
                          compact
                          value={template.color || shiftColor}
                          onChange={(c) => handleUpdateTemplate(template.id, 'color', c)}
                        />
                        <input
                          type="text"
                          placeholder="Tên ca..."
                          value={template.name}
                          onChange={(e) => handleUpdateTemplate(template.id, 'name', e.target.value)}
                          className="flex-1 min-w-[100px] bg-transparent border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-white/30 text-white transition-colors"
                        />
                        <input
                          type="time"
                          value={template.startTime}
                          onChange={(e) => handleUpdateTemplate(template.id, 'startTime', e.target.value)}
                          className="w-[90px] bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-white/30 text-white [color-scheme:dark] transition-colors"
                        />
                        <span className="text-white/30 text-xs">-</span>
                        <input
                          type="time"
                          value={template.endTime}
                          onChange={(e) => handleUpdateTemplate(template.id, 'endTime', e.target.value)}
                          className="w-[90px] bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-white/30 text-white [color-scheme:dark] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveTemplate(template.id)}
                          className="p-1.5 text-white/30 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags/Categories & Accounts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
                  <div className="text-sm font-medium text-white/90">Danh mục chi tiêu</div>
                  <div className="flex flex-wrap gap-1.5">
                    {expenseCategories.map((cat) => (
                      <div key={cat} className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                        <span className="text-xs text-white/80">{cat}</span>
                        <button type="button" onClick={() => handleRemoveCategory(cat)} className="text-white/40 hover:text-rose-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Thêm..."
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-white/30 text-white transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      disabled={!newCategory.trim()}
                      className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
                  <div className="text-sm font-medium text-white/90">Nguồn tiền / Ví</div>
                  <div className="flex flex-wrap gap-1.5">
                    {accounts.map((acc) => (
                      <div key={acc} className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                        <span className="text-xs text-white/80">{acc}</span>
                        <button type="button" onClick={() => handleRemoveAccount(acc)} className="text-white/40 hover:text-rose-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Thêm..."
                      value={newAccount}
                      onChange={(e) => setNewAccount(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAccount())}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-white/30 text-white transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleAddAccount}
                      disabled={!newAccount.trim()}
                      className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </form>

        <div className="p-4 border-t border-white/10 bg-[#121214] shrink-0 z-10">
          <button
            type="submit"
            onClick={handleSubmit}
            className="w-full bg-white text-black py-3 rounded-xl font-bold text-sm hover:bg-white/90 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            Lưu cài đặt
          </button>
        </div>
      </motion.div>
    </div>
  );
}
