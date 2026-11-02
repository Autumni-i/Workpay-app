import { useMemo, useState } from 'react';
import { ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line } from 'recharts';
import { Shift, UserSettings } from '../types';
import { formatCurrency } from '../lib/utils';
import { format, eachDayOfInterval } from 'date-fns';

interface ShiftsChartsProps {
  shifts: Shift[];
  currency: string;
  settings: UserSettings;
}

export default function ShiftsCharts({ shifts, currency, settings }: ShiftsChartsProps) {
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    shifts.forEach(s => months.add(s.date.substring(0, 7)));
    
    const sorted = Array.from(months).sort().reverse();
    const currentMonth = new Date().toISOString().substring(0, 7);
    if (!sorted.includes(currentMonth)) {
      sorted.unshift(currentMonth);
    }
    return sorted;
  }, [shifts]);

  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0] || new Date().toISOString().substring(0, 7));

  const { cycleStart, cycleEnd } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number); // Note: month is 1-12
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

  const chartData = useMemo(() => {
    const days: Record<string, { date: string; hours: number; pay: number }> = {};
    const intervalDays = eachDayOfInterval({ start: cycleStart, end: cycleEnd });
    intervalDays.forEach(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      days[dateStr] = { date: dateStr, hours: 0, pay: 0 };
    });

    const filteredShifts = shifts.filter(s => {
      const shiftDate = new Date(s.date + 'T12:00:00');
      return shiftDate >= cycleStart && shiftDate <= cycleEnd;
    });

    filteredShifts.forEach(s => {
      if (days[s.date]) {
        days[s.date].hours += s.hoursWorked;
        days[s.date].pay += s.totalPay;
      }
    });

    return Object.values(days).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [shifts, cycleStart, cycleEnd]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 p-3 rounded-xl shadow-2xl">
          <p className="text-white/80 text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm flex items-center gap-2" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
              {entry.name === 'pay' ? 'Thu nhập' : 'Số giờ'}: 
              <span className="font-semibold text-white">
                {entry.name === 'pay' 
                  ? formatCurrency(entry.value, currency).replace(/₫|VND/g, '').trim() 
                  : `${entry.value.toFixed(1)}h`}
              </span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (shifts.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-4 rounded-3xl shadow-xl gap-4">
        <div>
          <h3 className="text-sm font-medium text-white/40 uppercase tracking-widest">{settings.payrollCutoffDate ? 'Thống kê kỳ lương' : 'Thống kê ca làm việc'}</h3>
          {settings.payrollCutoffDate && (
            <div className="text-[10px] text-white/50 mt-1">
              {format(cycleStart, 'dd/MM')} - {format(cycleEnd, 'dd/MM')}
              {settings.paydayDate && ` (Nhận: ${String(settings.paydayDate).padStart(2, '0')}/${format(new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() + 1, 1), 'MM')})`}
            </div>
          )}
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-white/30 text-white font-medium"
        >
          {availableMonths.map(m => {
            const [y, mo] = m.split('-');
            return <option key={m} value={m}>Tháng {mo}/{y}</option>;
          })}
        </select>
      </div>

      <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-5 rounded-3xl shadow-xl">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
                yAxisId="left"
                stroke="rgba(255,255,255,0.2)" 
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="rgba(255,255,255,0.2)" 
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                tickFormatter={(val) => (val / 1000).toString() + 'k'}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Legend formatter={(value) => <span className="text-xs text-white/70">{value === 'pay' ? 'Thu nhập' : 'Số giờ làm'}</span>} />
              <Bar yAxisId="left" dataKey="hours" fill="#666666" radius={[2, 2, 0, 0]} opacity={0.8} />
              <Line yAxisId="right" type="monotone" dataKey="pay" stroke="#ffffff" strokeWidth={3} dot={{ fill: '#ffffff', r: 3, strokeWidth: 2, stroke: '#161617' }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
