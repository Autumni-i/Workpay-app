import { useState } from 'react';
import { Shift } from '../types';
import { exportToSheets, downloadAsExcel, downloadAsCSV, requestAccessToken, hasAccessToken } from '../lib/workspace';
import { FileSpreadsheet, Download, FileText, Loader2 } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

interface WorkspaceActionsProps {
  shifts: Shift[];
}

export default function WorkspaceActions({ shifts }: WorkspaceActionsProps) {
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  
  const handleAuthAndExecute = async (action: () => Promise<void>) => {
    if (!hasAccessToken()) {
      requestAccessToken();
      // Wait for the custom event
      window.addEventListener('google-auth-success', async function handler() {
        window.removeEventListener('google-auth-success', handler);
        await action();
      });
    } else {
      await action();
    }
  };

  const onExportSheets = () => {
    if (shifts.length === 0) return alert('Không có ca làm nào để xuất');
    handleAuthAndExecute(async () => {
      setIsExportingSheets(true);
      try {
        const url = await exportToSheets(shifts);
        alert(`Xuất thành công! Bạn có thể xem tại đây: ${url}`);
        window.open(url, '_blank');
      } catch (err) {
        console.error(err);
        alert('Lỗi khi xuất ra Google Sheets.');
      } finally {
        setIsExportingSheets(false);
      }
    });
  };

  return (
    <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl p-6 border border-white/10 shadow-xl flex flex-col gap-6">
      <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest">Xuất Dữ Liệu & Tích Hợp</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Local Excel Export */}
        <button
          onClick={() => downloadAsExcel(shifts)}
          disabled={shifts.length === 0}
          className="flex items-center justify-center gap-2 bg-white/80/20 hover:bg-white/80/40 text-white/90 border border-white/10 disabled:opacity-50 disabled:hover:bg-white/80/20 font-medium py-2.5 px-4 rounded-xl transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          <span>Excel</span>
        </button>

        {/* Local CSV Export */}
        <button
          onClick={() => downloadAsCSV(shifts)}
          disabled={shifts.length === 0}
          className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white/80 border border-white/20 disabled:opacity-50 disabled:hover:bg-white/10 font-medium py-2.5 px-4 rounded-xl transition-colors text-sm"
        >
          <FileText className="w-4 h-4" />
          <span>CSV</span>
        </button>

        {/* Google Sheets Export */}
        <button
          onClick={onExportSheets}
          disabled={shifts.length === 0 || isExportingSheets}
          className="flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white font-medium py-2.5 px-4 rounded-xl transition-colors text-sm"
        >
          {isExportingSheets ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          <span>Google Sheets</span>
        </button>
      </div>
    </div>
  );
}
