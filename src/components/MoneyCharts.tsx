import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Transaction, Shift, UserSettings } from '../types';
import { formatCurrency } from '../lib/utils';
import { downloadMonthlyReportPDF } from '../lib/workspace';
import { FileText } from 'lucide-react';
import { format } from 'date-fns';

interface MoneyChartsProps {
  transactions: Transaction[];
  shifts?: Shift[];
  currency: string;
  settings: UserSettings;
}

const COLORS = ['#ffffff', '#cccccc', '#999999', '#666666', '#444444', '#333333', '#222222', '#111111'];

export default function MoneyCharts({ transactions, shifts = [], currency, settings }: MoneyChartsProps) {
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => months.add(t.date.substring(0, 7)));
    shifts.forEach(s => months.add(s.date.substring(0, 7)));
    
    const sorted = Array.from(months).sort().reverse();
    const currentMonth = new Date().toISOString().substring(0, 7);
    if (!sorted.includes(currentMonth)) {
      sorted.unshift(currentMonth);
    }
    return sorted;
  }, [transactions, shifts]);

  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0] || new Date().toISOString().substring(0, 7));

  const { cycleStart, cycleEnd } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const cutoff = settings.payrollCutoffDate;
    
    if (cutoff && cutoff >= 1 && cutoff <= 31) {
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const actualCutoff = Math.min(cutoff, lastDayOfMonth);
      
      const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
      const actualPrevCutoff = Math.min(cutoff, prevMonthLastDay);
      
      const start = new Date(year, month - 2, actualPrevCutoff + 1, 0, 0, 0, 0);
      const end = new Date(year, month - 1, actualCutoff, 23, 59, 59, 999);
      return { cycleStart: start, cycleEnd: end };
    }
    
    return {
      cycleStart: new Date(year, month - 1, 1, 0, 0, 0, 0),
      cycleEnd: new Date(year, month, 0, 23, 59, 59, 999)
    };
  }, [selectedMonth, settings.payrollCutoffDate]);

  const filteredTransactions = useMemo(() => 
    transactions.filter(t => {
      const d = new Date(t.date + 'T12:00:00');
      return d >= cycleStart && d <= cycleEnd;
    }),
  [transactions, cycleStart, cycleEnd]);

  const filteredShifts = useMemo(() => 
    shifts.filter(s => {
      const d = new Date(s.date + 'T12:00:00');
      return d >= cycleStart && d <= cycleEnd;
    }),
  [shifts, cycleStart, cycleEnd]);

  const expenseByCategory = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    const grouped = expenses.reduce((acc, t) => {
      const cat = t.category || 'Khác';
      acc[cat] = (acc[cat] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a: { name: string; value: number }, b: { name: string; value: number }) => b.value - a.value);
  }, [filteredTransactions]);

  const dailyCashflow = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const days: Record<string, { date: string; income: number; expense: number }> = {};
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${selectedMonth}-${i.toString().padStart(2, '0')}`;
      days[dateStr] = { date: dateStr, income: 0, expense: 0 };
    }

    filteredTransactions.forEach(t => {
      if (days[t.date]) {
        if (t.type === 'income') days[t.date].income += t.amount;
        if (t.type === 'expense') days[t.date].expense += t.amount;
      }
    });

    filteredShifts.forEach(s => {
      if (days[s.date]) {
        days[s.date].income += s.totalPay;
      }
    });

    return Object.values(days).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredTransactions, filteredShifts, selectedMonth]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 p-3 rounded-xl shadow-2xl">
          <p className="text-white/80 text-sm font-medium mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name === 'value' ? entry.payload.name : (entry.name === 'income' ? 'Thu nhập' : 'Chi phí')}: {formatCurrency(entry.value, currency).replace(/₫|VND/g, '').trim()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (transactions.length === 0 && shifts.length === 0) return null;

  return (
    <div className="flex flex-col gap-6 mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-4 rounded-3xl shadow-xl gap-4">
        <div>
          <h3 className="text-sm font-medium text-white/40 uppercase tracking-widest">{settings.payrollCutoffDate ? 'Thống kê kỳ lương' : 'Thống kê tháng'}</h3>
          {settings.payrollCutoffDate && (
            <div className="text-[10px] text-white/50 mt-1">
              {format(cycleStart, 'dd/MM')} - {format(cycleEnd, 'dd/MM')}
              {settings.paydayDate && ` (Nhận: ${String(settings.paydayDate).padStart(2, '0')}/${format(new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() + 1, 1), 'MM')})`}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="flex-1 sm:flex-none bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/30 text-white font-medium"
          >
            {availableMonths.map(m => {
              const [y, mo] = m.split('-');
              return <option key={m} value={m}>Tháng {mo}/{y}</option>;
            })}
          </select>
          <button
            onClick={() => downloadMonthlyReportPDF(shifts, transactions, selectedMonth, currency)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white/80 border border-white/20 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Xuất PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense by Category Chart */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-5 rounded-3xl shadow-xl">
          <h3 className="text-sm font-medium text-white/40 uppercase tracking-widest mb-6">Cơ cấu chi tiêu</h3>
          <div className="h-64">
            {expenseByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {expenseByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-xs text-white/70">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-white/30">
                Không có dữ liệu chi tiêu trong tháng này
              </div>
            )}
          </div>
        </div>

        {/* Cashflow Chart */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-5 rounded-3xl shadow-xl">
          <h3 className="text-sm font-medium text-white/40 uppercase tracking-widest mb-6">Dòng tiền từng ngày</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyCashflow} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="rgba(255,255,255,0.2)" 
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                  tickFormatter={(val) => val.slice(8)} // Show DD only
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.2)" 
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                  tickFormatter={(val) => (val / 1000).toString() + 'k'}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Legend formatter={(value) => <span className="text-xs text-white/70">{value === 'income' ? 'Thu nhập' : 'Chi phí'}</span>} />
                <Bar dataKey="income" fill="#ffffff" radius={[2, 2, 0, 0]} />
                <Bar dataKey="expense" fill="#666666" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
