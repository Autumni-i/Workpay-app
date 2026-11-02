import { Briefcase, DollarSign, Settings as SettingsIcon, LogIn, LogOut, Menu, X, ChevronRight, User as UserIcon, Calendar, Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { SyncStatus } from '../lib/useFirebaseData';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  activeTab: 'shifts' | 'money' | 'calendar';
  setActiveTab: (tab: 'shifts' | 'money' | 'calendar') => void;
  user: User | null;
  logout: () => void;
  onLoginClick: () => void;
  onSettingsClick: () => void;
  syncStatus?: SyncStatus;
  lastSyncTime?: Date | null;
  manualSync?: () => void;
}

export default function Sidebar({ 
  isOpen, 
  setIsOpen, 
  activeTab, 
  setActiveTab, 
  user, 
  logout, 
  onLoginClick, 
  onSettingsClick,
  syncStatus = 'guest',
  lastSyncTime,
  manualSync
}: SidebarProps) {
  const menuItems = [
    { id: 'shifts' as const, label: 'Bảng chấm công', icon: <Briefcase className="w-5 h-5" /> },
    { id: 'money' as const, label: 'Quản lý thu chi', icon: <DollarSign className="w-5 h-5" /> },
    { id: 'calendar' as const, label: 'Lịch', icon: <Calendar className="w-5 h-5" /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Sidebar */}
          <motion.aside 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0a0a]/90 backdrop-blur-3xl border-r border-white/10 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.8)]"
          >
            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-black" />
                </div>
                <span className="text-xl font-semibold tracking-tight text-white">WorkPay</span>
              </div>
              <button 
                className="p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User & Settings area */}
            <div className="relative z-10 p-4 border-b border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-full h-full rounded-full" />
                    ) : (
                      <UserIcon className="w-5 h-5 text-white/60" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="text-sm font-medium text-white truncate">
                      {user ? (user.displayName || 'Người dùng') : 'Khách'}
                    </div>
                    <div className="text-xs text-white/40 truncate">
                      {user ? user.email : 'Chưa đăng nhập'}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={onSettingsClick}
                  className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
                  title="Cài đặt"
                >
                  <SettingsIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Cloud Sync Status Indicator in Sidebar */}
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {syncStatus === 'syncing' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white/90 shrink-0" />
                  ) : syncStatus === 'synced' ? (
                    <Cloud className="w-3.5 h-3.5 text-white/90 shrink-0" />
                  ) : syncStatus === 'error' ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <CloudOff className="w-3.5 h-3.5 text-white/40 shrink-0" />
                  )}

                  <div className="truncate">
                    <div className="text-[11px] font-medium text-white/80 truncate">
                      {syncStatus === 'syncing'
                        ? 'Đang đồng bộ...'
                        : syncStatus === 'synced'
                        ? 'Đã đồng bộ đám mây'
                        : syncStatus === 'error'
                        ? 'Lỗi đồng bộ'
                        : 'Lưu trên thiết bị'}
                    </div>
                    {lastSyncTime && syncStatus === 'synced' && (
                      <div className="text-[10px] text-white/40">
                        {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>

                {user && manualSync && (
                  <button
                    onClick={manualSync}
                    disabled={syncStatus === 'syncing'}
                    className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-50 transition-colors shrink-0"
                    title="Đồng bộ ngay"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                {user ? (
                  <button
                    onClick={logout}
                    className="p-1.5 text-rose-400/80 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors flex-1 flex items-center justify-center gap-2"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Đăng xuất</span>
                  </button>
                ) : (
                  <button
                    onClick={onLoginClick}
                    className="p-1.5 text-white/90/80 hover:text-white/90 hover:bg-white/90/10 rounded-lg transition-colors flex-1 flex items-center justify-center gap-2"
                    title="Đăng nhập"
                  >
                    <LogIn className="w-4 h-4" />
                    <span className="text-sm font-medium">Đăng nhập đồng bộ</span>
                  </button>
                )}
              </div>
            </div>

            {/* Navigation */}
            <nav className="relative z-10 flex-1 p-4 space-y-1.5 overflow-y-auto">
              {menuItems.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300
                      ${isActive 
                        ? 'bg-white/15 text-white shadow-sm' 
                        : 'text-white/60 hover:bg-white/10 hover:text-white border border-transparent'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4" />}
                  </button>
                );
              })}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
