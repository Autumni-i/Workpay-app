import { useState, FormEvent, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Transaction, Shift, UserSettings } from '../types';
import { formatCurrency } from '../lib/utils';
import { PlusCircle, Trash2, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';
import MoneyCharts from './MoneyCharts';

interface MoneyManagerProps {
  shifts: Shift[];
  transactions: Transaction[];
  onAddTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  settings: UserSettings;
}

export default function MoneyManager({ shifts, transactions, onAddTransaction, onDeleteTransaction, settings }: MoneyManagerProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('');

  const currency = settings.currency;
  const expenseCategories = settings.expenseCategories || [];
  const accounts = settings.accounts || [];

  // Calculate totals
  const totalShiftIncome = shifts.reduce((sum, s) => sum + s.totalPay, 0);
  const totalOtherIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = totalShiftIncome + totalOtherIncome;
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const accountBalances = useMemo(() => {
    const balances = accounts.reduce((acc, accountName) => {
      acc[accountName] = 0;
      return acc;
    }, {} as Record<string, number>);

    transactions.forEach(t => {
      if (t.account && balances[t.account] !== undefined) {
        if (t.type === 'income') balances[t.account] += t.amount;
        if (t.type === 'expense') balances[t.account] -= t.amount;
      }
    });
    return balances;
  }, [transactions, accounts]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    const newTx: Transaction = {
      id: uuidv4(),
      date,
      type,
      amount: parsedAmount,
      description,
    };

    if (type === 'expense' && category) {
      newTx.category = category;
    }

    if (account) {
      newTx.account = account;
    }

    onAddTransaction(newTx);
    
    setAmount('');
    setDescription('');
    setCategory('');
    setAccount('');
  };

  return (
    <div className="flex flex-col gap-6 h-full pb-8">
      {/* Financial Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl p-6 border border-white/10 shadow-xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-white/80 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs uppercase font-semibold tracking-wider">Tổng thu nhập</span>
          </div>
          <div className="text-2xl font-medium text-white">
            {formatCurrency(totalIncome, currency).replace(/₫|VND/g, '').trim()}
            <span className="text-sm text-white/40 ml-1">{currency}</span>
          </div>
        </div>
        
        <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl p-6 border border-white/10 shadow-xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-white/60 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs uppercase font-semibold tracking-wider">Tổng chi tiêu</span>
          </div>
          <div className="text-2xl font-medium text-white">
            {formatCurrency(totalExpense, currency).replace(/₫|VND/g, '').trim()}
            <span className="text-sm text-white/40 ml-1">{currency}</span>
          </div>
        </div>
        
        <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl p-6 border border-white/10 shadow-xl flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign className="w-16 h-16 text-white" />
          </div>
          <div className="flex items-center gap-2 text-white/60 mb-1 relative z-10">
            <span className="text-xs uppercase font-semibold tracking-wider">Số dư (Balance)</span>
          </div>
          <div className={`text-3xl font-light relative z-10 ${balance >= 0 ? 'text-white' : 'text-white/60'}`}>
            {formatCurrency(balance, currency).replace(/₫|VND/g, '').trim()}
            <span className="text-sm font-medium ml-1 opacity-50">{currency}</span>
          </div>
        </div>
      </div>

      {/* Account Balances Grid */}
      {accounts.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest">Số dư tài khoản</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {accounts.map(acc => (
              <div key={acc} className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl p-4 border border-white/10 shadow-md flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-white/50 mb-0.5">
                  <Wallet className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold tracking-wider uppercase truncate">{acc}</span>
                </div>
                <div className={`text-sm font-medium ${accountBalances[acc] >= 0 ? 'text-white/90' : 'text-white/60'}`}>
                  {formatCurrency(accountBalances[acc], currency).replace(/₫|VND/g, '').trim()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <MoneyCharts transactions={transactions} shifts={shifts} currency={currency} settings={settings} />

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Add Transaction Form */}
        <form onSubmit={handleSubmit} className="w-full lg:w-1/3 bg-white/[0.03] backdrop-blur-2xl rounded-3xl p-6 border border-white/10 shadow-xl flex flex-col gap-4 h-fit">
          <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest mb-2">Thêm giao dịch mới</h2>
          
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => { setType('expense'); setCategory(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${type === 'expense' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'}`}
            >
              Khoản chi
            </button>
            <button
              type="button"
              onClick={() => { setType('income'); setCategory(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${type === 'income' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'}`}
            >
              Thu nhập
            </button>
          </div>

          <div className="space-y-1.5 mt-2">
            <label className="text-xs font-semibold text-white/60 ml-1">Số tiền</label>
            <input
              type="number"
              required
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="VD: 50000"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 text-white placeholder-white/30"
            />
          </div>

          {type === 'expense' && expenseCategories.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/60 ml-1">Danh mục</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 text-white [color-scheme:dark]"
              >
                <option value="">Chọn danh mục...</option>
                {expenseCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/60 ml-1">Tài khoản</label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 text-white [color-scheme:dark]"
              >
                <option value="">Chọn tài khoản...</option>
                {accounts.map(acc => (
                  <option key={acc} value={acc}>
                    {acc} ({accountBalances[acc] >= 0 ? '+' : ''}{formatCurrency(accountBalances[acc], currency).replace(/₫|VND/g, '').trim()})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/60 ml-1">Mô tả</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'expense' ? 'VD: Ăn sáng, xăng xe...' : 'VD: Lương, thưởng...'}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 text-white placeholder-white/30"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/60 ml-1">Ngày</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 text-white"
            />
          </div>

          <button
            type="submit"
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all mt-2 flex items-center justify-center gap-2 ${
              type === 'expense' 
                ? 'bg-white/10 text-white/60 hover:bg-white/20 border border-white/10' 
                : 'bg-white/10 text-white/90 hover:bg-white/20 border border-white/10'
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            <span>Lưu giao dịch</span>
          </button>
        </form>

        {/* Transaction List */}
        <div className="flex-1 bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/10 shadow-xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-sm font-medium text-white/40 uppercase tracking-widest">Lịch sử giao dịch</h2>
          </div>
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {transactions.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/40">
                Chưa có giao dịch nào được ghi lại.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left min-w-[500px]">
                  <thead>
                  <tr className="text-white/30 text-[11px] uppercase tracking-wider">
                    <th className="pb-4 font-semibold">Ngày</th>
                    <th className="pb-4 font-semibold">Mô tả</th>
                    <th className="pb-4 font-semibold">Tài khoản</th>
                    <th className="pb-4 font-semibold text-right">Số tiền</th>
                    <th className="pb-4 font-semibold text-center"></th>
                  </tr>
                </thead>
                <tbody className="text-sm text-white/80">
                  {transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((t) => (
                    <tr key={t.id} className="border-b border-white/5">
                      <td className="py-4 whitespace-nowrap">{t.date}</td>
                      <td className="py-4 text-white font-medium">
                        <div>{t.description}</div>
                        {t.category && (
                          <div className="mt-1">
                            <span className="inline-block px-1.5 py-0.5 rounded-md bg-white/5 text-[10px] text-white/50">{t.category}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-4">
                        {t.account ? (
                          <span className="inline-block px-2 py-1 rounded-lg bg-white/5 text-xs font-medium text-white/70 border border-white/5">
                            {t.account}
                          </span>
                        ) : (
                          <span className="text-white/20 text-xs italic">N/A</span>
                        )}
                      </td>
                      <td className="py-4 text-right whitespace-nowrap">
                        <div className={`flex items-center justify-end gap-1 ${t.type === 'income' ? 'text-white/90' : 'text-white/60'}`}>
                          {t.type === 'income' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                          {formatCurrency(t.amount, currency).replace(/₫|VND/g, '').trim()}
                        </div>
                      </td>
                      <td className="py-4 flex items-center justify-center">
                        <button
                          onClick={() => onDeleteTransaction(t.id)}
                          className="p-1.5 text-white/30 hover:text-white/60 rounded-md transition-colors"
                          title="Xóa giao dịch"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
