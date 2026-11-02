import { useState } from 'react';
import { Shift, UserSettings } from '../types';
import { formatCurrency } from '../lib/utils';
import { Trash2, Edit2, Flame, Sparkles } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import EditShiftModal from './EditShiftModal';

interface ShiftListProps {
  shifts: Shift[];
  onDelete: (id: string) => void;
  onUpdate: (shift: Shift) => void;
  settings: UserSettings;
}

export default function ShiftList({ shifts, onDelete, onUpdate, settings }: ShiftListProps) {
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  if (shifts.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/10 shadow-xl overflow-hidden p-8 text-center justify-center items-center">
        <p className="text-white/40">Chưa có ca làm nào. Hãy bắt đầu bằng cách thêm ca làm đầu tiên!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/10 shadow-xl overflow-hidden">
      <div className="p-6 border-b border-white/10 flex justify-between items-center">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest">Nhật ký làm việc</h2>
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
        <div className="overflow-x-auto w-full custom-scrollbar pb-2">
          <table className="w-full text-left min-w-[640px]">
            <thead>
            <tr className="text-white/30 text-[11px] uppercase tracking-wider">
              <th className="pb-4 font-semibold">Ngày</th>
              <th className="pb-4 font-semibold">Thời gian</th>
              <th className="pb-4 font-semibold text-right">Giờ làm</th>
              <th className="pb-4 font-semibold text-right">Thu nhập</th>
              <th className="pb-4 font-semibold">Ghi chú</th>
              <th className="pb-4 font-semibold text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="text-sm text-white/80">
            {shifts.map((shift) => {
              const mult = shift.holidayMultiplier || (shift.isHoliday ? 3 : 1);
              const isHolidayShift = mult > 1 || shift.isHoliday;

              return (
                <tr key={shift.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium text-white/90">{shift.date}</span>
                      {isHolidayShift && (
                        <div className="mt-1 flex items-center gap-1">
                          <span 
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                              mult >= 4
                                ? 'bg-gradient-to-r from-red-600/30 to-amber-500/30 text-amber-300 border-amber-500/40'
                                : mult >= 3
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}
                            title={shift.holidayName || `Hệ số x${mult}`}
                          >
                            <Flame className="w-2.5 h-2.5 shrink-0" />
                            <span>{shift.holidayName ? `${shift.holidayName} (x${mult})` : `Lễ x${mult}`}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 whitespace-nowrap">
                    <span className="text-white/80">{shift.startTime} - {shift.endTime}</span>
                  </td>
                  <td className="py-4 font-mono text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-white/90">{shift.hoursWorked.toFixed(2)}h</span>
                      {(shift.bonusHours || 0) > 0 && (
                        <span 
                          className="text-[10px] text-white/70 bg-white/10 border border-white/20 px-1.5 py-0.5 rounded font-medium mt-1 inline-flex items-center"
                          title="Số giờ làm trong khung giờ sau 22h"
                        >
                          {shift.bonusHours?.toFixed(2)}h sau 22h
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 text-right whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <div className="font-semibold text-white">
                        {formatCurrency(shift.totalPay, settings.currency)}
                      </div>
                      {isHolidayShift && (
                        <span className="text-[11px] text-rose-300/80 font-medium">
                          x{mult} ({formatCurrency(shift.hourlyRate * mult, settings.currency)}/h)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 max-w-[150px] truncate text-white/60">
                    {shift.notes || '-'}
                  </td>
                  <td className="py-4 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setEditingShift(shift)}
                      className="p-1.5 text-white/90 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                      title="Chỉnh sửa ca làm"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(shift.id)}
                      className="p-1.5 text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors"
                      title="Xóa ca làm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      <div className="p-6 bg-white/5 border-t border-white/5 flex justify-between items-center">
        <span className="text-xs text-white/80 font-medium">Đã ghi nhận {shifts.length} ca làm</span>
      </div>

      <AnimatePresence>
        {editingShift && (
          <EditShiftModal
            shift={editingShift}
            settings={settings}
            onClose={() => setEditingShift(null)}
            onSave={(updated) => {
              onUpdate(updated);
              setEditingShift(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
