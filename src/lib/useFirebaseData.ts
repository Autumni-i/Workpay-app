import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { Shift, Transaction, UserSettings } from '../types';

const DEFAULT_SETTINGS: UserSettings = {
  defaultHourlyRate: 30000,
  nightShiftBonusType: 'percent',
  nightShiftBonusValue: 30,
  nightShiftBonusPercent: 30,
  currency: 'VND',
  shiftTemplates: [],
  expenseCategories: ['Tiền ăn', 'Di chuyển', 'BHXH', 'Khác'],
  accounts: ['Tiền mặt', 'Momo'],
  shiftColor: '#10b981',
  googleEventColor: '#3b82f6',
  autoSyncGoogleCalendar: false,
  defaultHolidayMultiplier: 3,
  autoDetectHolidays: true,
};

export function cleanShift(shift: Shift): Shift {
  const cleaned: Shift = {
    id: shift.id,
    date: shift.date || new Date().toISOString().split('T')[0],
    startTime: shift.startTime || '08:00',
    endTime: shift.endTime || '12:00',
    hourlyRate: Number(shift.hourlyRate) || 0,
    hoursWorked: Number(shift.hoursWorked) || 0,
    totalPay: Number(shift.totalPay) || 0,
    createdAt: shift.createdAt || new Date().toISOString(),
  };

  if (shift.isHoliday !== undefined) {
    cleaned.isHoliday = Boolean(shift.isHoliday);
  }
  if (shift.holidayMultiplier !== undefined && shift.holidayMultiplier !== null) {
    cleaned.holidayMultiplier = Number(shift.holidayMultiplier) || 1;
  }
  if (shift.holidayName) {
    cleaned.holidayName = String(shift.holidayName).slice(0, 100);
  }
  if (shift.color) {
    cleaned.color = String(shift.color).slice(0, 20);
  }
  if (shift.notes !== undefined && shift.notes !== null) {
    cleaned.notes = String(shift.notes).slice(0, 1000);
  }
  if (shift.regularHours !== undefined && shift.regularHours !== null) {
    cleaned.regularHours = Number(shift.regularHours);
  }
  if (shift.bonusHours !== undefined && shift.bonusHours !== null) {
    cleaned.bonusHours = Number(shift.bonusHours);
  }
  if (shift.googleEventId) {
    cleaned.googleEventId = String(shift.googleEventId).slice(0, 256);
  }
  if (shift.syncedToCalendar !== undefined) {
    cleaned.syncedToCalendar = Boolean(shift.syncedToCalendar);
  }
  if (shift.updatedAt) {
    cleaned.updatedAt = shift.updatedAt;
  }

  return cleaned;
}

export function cleanTransaction(tx: Transaction): Transaction {
  const cleaned: Transaction = {
    id: tx.id,
    date: tx.date || new Date().toISOString().split('T')[0],
    type: tx.type === 'income' ? 'income' : 'expense',
    amount: Number(tx.amount) || 0,
    description: String(tx.description || '').slice(0, 200),
    createdAt: tx.createdAt || new Date().toISOString(),
  };

  if (tx.category) {
    cleaned.category = String(tx.category).slice(0, 100);
  }
  if (tx.account) {
    cleaned.account = String(tx.account).slice(0, 100);
  }

  return cleaned;
}

export function cleanSettings(settings: Partial<UserSettings>): UserSettings {
  const bonusType = settings.nightShiftBonusType === 'fixed' ? 'fixed' : 'percent';
  const bonusValue = settings.nightShiftBonusValue !== undefined
    ? Number(settings.nightShiftBonusValue)
    : Number(settings.nightShiftBonusPercent ?? 30);

  const cleaned: UserSettings = {
    defaultHourlyRate: Number(settings.defaultHourlyRate) || 30000,
    nightShiftBonusType: bonusType,
    nightShiftBonusValue: bonusValue,
    nightShiftBonusPercent: bonusValue,
    currency: settings.currency || 'VND',
    shiftTemplates: Array.isArray(settings.shiftTemplates) ? settings.shiftTemplates : [],
    expenseCategories: Array.isArray(settings.expenseCategories) ? settings.expenseCategories : ['Tiền ăn', 'Di chuyển', 'BHXH', 'Khác'],
    accounts: Array.isArray(settings.accounts) ? settings.accounts : ['Tiền mặt', 'Momo'],
    shiftColor: settings.shiftColor || '#10b981',
    googleEventColor: settings.googleEventColor || '#3b82f6',
    autoSyncGoogleCalendar: settings.autoSyncGoogleCalendar ?? false,
    defaultHolidayMultiplier: Number(settings.defaultHolidayMultiplier) || 3,
    autoDetectHolidays: settings.autoDetectHolidays !== false,
    updatedAt: new Date().toISOString()
  };
  
  if (settings.payrollCutoffDate !== undefined) {
    cleaned.payrollCutoffDate = Number(settings.payrollCutoffDate);
  }
  if (settings.paydayDate !== undefined) {
    cleaned.paydayDate = Number(settings.paydayDate);
  }
  
  return cleaned;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'guest';

export function useFirebaseData() {
  const { user, loading } = useAuth();
  const previousUid = useRef<string | null>(null);
  const isInitialSyncDone = useRef(false);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('guest');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  // Safe localStorage helper
  const loadLocalShifts = (uid?: string | null): Shift[] => {
    try {
      if (uid) {
        const userSaved = localStorage.getItem(`partTimeShifts_${uid}`);
        if (userSaved) {
          const parsed = JSON.parse(userSaved);
          if (Array.isArray(parsed)) return parsed.map(cleanShift);
        }
      }
      const generalSaved = localStorage.getItem('partTimeShifts');
      if (generalSaved) {
        const parsed = JSON.parse(generalSaved);
        if (Array.isArray(parsed)) return parsed.map(cleanShift);
      }
    } catch (e) {
      console.error("Error reading shifts from localStorage", e);
    }
    return [];
  };

  const loadLocalTx = (uid?: string | null): Transaction[] => {
    try {
      if (uid) {
        const userSaved = localStorage.getItem(`partTimeTransactions_${uid}`);
        if (userSaved) {
          const parsed = JSON.parse(userSaved);
          if (Array.isArray(parsed)) return parsed.map(cleanTransaction);
        }
      }
      const generalSaved = localStorage.getItem('partTimeTransactions');
      if (generalSaved) {
        const parsed = JSON.parse(generalSaved);
        if (Array.isArray(parsed)) return parsed.map(cleanTransaction);
      }
    } catch (e) {
      console.error("Error reading transactions from localStorage", e);
    }
    return [];
  };

  const loadLocalSettings = (uid?: string | null): UserSettings => {
    try {
      if (uid) {
        const userSaved = localStorage.getItem(`partTimeSettings_${uid}`);
        if (userSaved) {
          const parsed = JSON.parse(userSaved);
          if (parsed && typeof parsed === 'object') return cleanSettings(parsed);
        }
      }
      const generalSaved = localStorage.getItem('partTimeSettings');
      if (generalSaved) {
        const parsed = JSON.parse(generalSaved);
        if (parsed && typeof parsed === 'object') return cleanSettings(parsed);
      }
    } catch (e) {
      console.error("Error reading settings from localStorage", e);
    }
    return DEFAULT_SETTINGS;
  };

  const [shifts, setShifts] = useState<Shift[]>(() => loadLocalShifts(user?.uid));
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadLocalTx(user?.uid));
  const [settings, setSettings] = useState<UserSettings>(() => loadLocalSettings(user?.uid));

  // Handle user authentication switches (Login / Logout / Change Account)
  useEffect(() => {
    if (loading) return;

    const currentUid = user?.uid || null;

    if (previousUid.current !== currentUid) {
      isInitialSyncDone.current = false;
      previousUid.current = currentUid;

      if (!user) {
        // Logged out: clean reset to guest storage
        setSyncStatus('guest');
        setSyncErrorMessage(null);
        setShifts(loadLocalShifts(null));
        setTransactions(loadLocalTx(null));
        setSettings(loadLocalSettings(null));
      } else {
        // Logged in: load user's cached storage
        setSyncStatus('syncing');
        setShifts(loadLocalShifts(currentUid));
        setTransactions(loadLocalTx(currentUid));
        setSettings(loadLocalSettings(currentUid));
      }
    }
  }, [user, loading]);

  // Save to localStorage when state changes
  useEffect(() => {
    try {
      const uid = previousUid.current;
      if (uid) {
        localStorage.setItem(`partTimeShifts_${uid}`, JSON.stringify(shifts));
      } else {
        localStorage.setItem('partTimeShifts', JSON.stringify(shifts));
      }
    } catch (e) {
      console.error("Failed to save shifts locally", e);
    }
  }, [shifts]);

  useEffect(() => {
    try {
      const uid = previousUid.current;
      if (uid) {
        localStorage.setItem(`partTimeTransactions_${uid}`, JSON.stringify(transactions));
      } else {
        localStorage.setItem('partTimeTransactions', JSON.stringify(transactions));
      }
    } catch (e) {
      console.error("Failed to save transactions locally", e);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      const uid = previousUid.current;
      if (uid) {
        localStorage.setItem(`partTimeSettings_${uid}`, JSON.stringify(settings));
      } else {
        localStorage.setItem('partTimeSettings', JSON.stringify(settings));
      }
    } catch (e) {
      console.error("Failed to save settings locally", e);
    }
  }, [settings]);

  // Firestore Realtime Synchronization
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setSyncStatus('guest');
      return;
    }

    const currentUid = user.uid;
    setSyncStatus('syncing');

    // 1. Settings listener
    const settingsPath = `users/${currentUid}`;
    const settingsRef = doc(db, 'users', currentUid);
    const unsubSettings = onSnapshot(settingsRef, async (docSnap) => {
      try {
        if (docSnap.exists()) {
          const remoteSettings = cleanSettings(docSnap.data() as UserSettings);
          setSettings(remoteSettings);
          localStorage.setItem(`partTimeSettings_${currentUid}`, JSON.stringify(remoteSettings));
        } else {
          // Initialize Firestore settings document
          const initialLocal = loadLocalSettings(currentUid);
          const toSave = cleanSettings(initialLocal);
          await setDoc(settingsRef, toSave, { merge: true });
        }
        setLastSyncTime(new Date());
      } catch (err) {
        console.warn("Error processing remote settings:", err);
      }
    }, (error) => {
      console.error("Firestore settings onSnapshot error:", error);
      setSyncStatus('error');
      setSyncErrorMessage('Không thể đồng bộ cài đặt với máy chủ.');
      try {
        handleFirestoreError(error, OperationType.GET, settingsPath);
      } catch (e) {
        // Handled
      }
    });

    // 2. Shifts listener
    const shiftsPath = `users/${currentUid}/shifts`;
    const shiftsRef = collection(db, 'users', currentUid, 'shifts');
    const unsubShifts = onSnapshot(shiftsRef, async (snapshot) => {
      try {
        const loadedShifts = snapshot.docs.map(d => cleanShift(d.data() as Shift));
        loadedShifts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Check if we have local guest / offline shifts that need to be uploaded to cloud
        const localShifts = loadLocalShifts(currentUid);
        const remoteIds = new Set(loadedShifts.map(s => s.id));
        const missingOnRemote = localShifts.filter(s => !remoteIds.has(s.id));

        if (missingOnRemote.length > 0 && !isInitialSyncDone.current) {
          // Upload missing local shifts to Firestore
          for (const s of missingOnRemote) {
            try {
              const cleaned = cleanShift(s);
              await setDoc(doc(db, 'users', currentUid, 'shifts', cleaned.id), cleaned);
              loadedShifts.push(cleaned);
            } catch (err) {
              console.warn("Failed to upload local shift during initial sync:", err);
            }
          }
          loadedShifts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        setShifts(loadedShifts);
        localStorage.setItem(`partTimeShifts_${currentUid}`, JSON.stringify(loadedShifts));
        isInitialSyncDone.current = true;
        setSyncStatus('synced');
        setLastSyncTime(new Date());
        setSyncErrorMessage(null);
      } catch (err) {
        console.warn("Error processing remote shifts:", err);
      }
    }, (error) => {
      console.error("Firestore shifts onSnapshot error:", error);
      setSyncStatus('error');
      setSyncErrorMessage('Lỗi đồng bộ dữ liệu ca làm việc.');
      try {
        handleFirestoreError(error, OperationType.LIST, shiftsPath);
      } catch (e) {
        // Handled
      }
    });

    // 3. Transactions listener
    const txPath = `users/${currentUid}/transactions`;
    const txRef = collection(db, 'users', currentUid, 'transactions');
    const unsubTx = onSnapshot(txRef, async (snapshot) => {
      try {
        const loadedTx = snapshot.docs.map(d => cleanTransaction(d.data() as Transaction));
        loadedTx.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

        const localTx = loadLocalTx(currentUid);
        const remoteTxIds = new Set(loadedTx.map(t => t.id));
        const missingTx = localTx.filter(t => !remoteTxIds.has(t.id));

        if (missingTx.length > 0 && !isInitialSyncDone.current) {
          for (const tx of missingTx) {
            try {
              const cleaned = cleanTransaction(tx);
              await setDoc(doc(db, 'users', currentUid, 'transactions', cleaned.id), cleaned);
              loadedTx.push(cleaned);
            } catch (err) {
              console.warn("Failed to upload local transaction during initial sync:", err);
            }
          }
          loadedTx.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
        }

        setTransactions(loadedTx);
        localStorage.setItem(`partTimeTransactions_${currentUid}`, JSON.stringify(loadedTx));
        setSyncStatus('synced');
        setLastSyncTime(new Date());
      } catch (err) {
        console.warn("Error processing remote transactions:", err);
      }
    }, (error) => {
      console.error("Firestore transactions onSnapshot error:", error);
      setSyncStatus('error');
      setSyncErrorMessage('Lỗi đồng bộ dữ liệu thu chi.');
      try {
        handleFirestoreError(error, OperationType.LIST, txPath);
      } catch (e) {
        // Handled
      }
    });

    return () => {
      unsubSettings();
      unsubShifts();
      unsubTx();
    };
  }, [user?.uid, loading]);

  // Manual Trigger to re-sync everything
  const manualSync = useCallback(async () => {
    if (!user) {
      setSyncStatus('guest');
      return;
    }

    try {
      setSyncStatus('syncing');
      setSyncErrorMessage(null);

      const currentUid = user.uid;

      // 1. Sync Settings
      const settingsRef = doc(db, 'users', currentUid);
      const snap = await getDoc(settingsRef);
      if (snap.exists()) {
        const s = cleanSettings(snap.data() as UserSettings);
        setSettings(s);
      } else {
        await setDoc(settingsRef, cleanSettings(settings), { merge: true });
      }

      // 2. Fetch remote shifts
      const shiftsSnap = await getDocs(collection(db, 'users', currentUid, 'shifts'));
      const remoteShifts = shiftsSnap.docs.map(d => cleanShift(d.data() as Shift));
      
      // Upload any local shifts not on remote
      const remoteIds = new Set(remoteShifts.map(s => s.id));
      for (const s of shifts) {
        if (!remoteIds.has(s.id)) {
          const cleaned = cleanShift(s);
          await setDoc(doc(db, 'users', currentUid, 'shifts', cleaned.id), cleaned);
          remoteShifts.push(cleaned);
        }
      }
      remoteShifts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setShifts(remoteShifts);

      // 3. Fetch remote transactions
      const txSnap = await getDocs(collection(db, 'users', currentUid, 'transactions'));
      const remoteTx = txSnap.docs.map(d => cleanTransaction(d.data() as Transaction));
      const remoteTxIds = new Set(remoteTx.map(t => t.id));
      for (const t of transactions) {
        if (!remoteTxIds.has(t.id)) {
          const cleaned = cleanTransaction(t);
          await setDoc(doc(db, 'users', currentUid, 'transactions', cleaned.id), cleaned);
          remoteTx.push(cleaned);
        }
      }
      remoteTx.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      setTransactions(remoteTx);

      setSyncStatus('synced');
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error("Manual sync error:", err);
      setSyncStatus('error');
      setSyncErrorMessage(err.message || 'Lỗi khi đồng bộ dữ liệu');
    }
  }, [user, shifts, transactions, settings]);

  const addShift = useCallback(async (shift: Shift) => {
    const cleaned = cleanShift(shift);

    // 1. Optimistic local update
    setShifts(prev => {
      const updated = [cleaned, ...prev.filter(s => s.id !== cleaned.id)];
      return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    // 2. Cloud sync if logged in
    if (user) {
      const path = `users/${user.uid}/shifts/${cleaned.id}`;
      try {
        setSyncStatus('syncing');
        await setDoc(doc(db, 'users', user.uid, 'shifts', cleaned.id), cleaned);
        setSyncStatus('synced');
        setLastSyncTime(new Date());
      } catch (error) {
        console.error("Failed to add shift to Firestore:", error);
        setSyncStatus('error');
        try {
          handleFirestoreError(error, OperationType.CREATE, path);
        } catch (e) {
          // Logged
        }
      }
    }
  }, [user]);

  const updateShift = useCallback(async (shift: Shift) => {
    const cleaned = cleanShift({
      ...shift,
      updatedAt: new Date().toISOString()
    });

    // 1. Optimistic local update
    setShifts(prev => {
      const updated = prev.map(s => s.id === cleaned.id ? cleaned : s);
      return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    // 2. Cloud sync if logged in
    if (user) {
      const path = `users/${user.uid}/shifts/${cleaned.id}`;
      try {
        setSyncStatus('syncing');
        await setDoc(doc(db, 'users', user.uid, 'shifts', cleaned.id), cleaned, { merge: true });
        setSyncStatus('synced');
        setLastSyncTime(new Date());
      } catch (error) {
        console.error("Failed to update shift in Firestore:", error);
        setSyncStatus('error');
        try {
          handleFirestoreError(error, OperationType.UPDATE, path);
        } catch (e) {
          // Logged
        }
      }
    }
  }, [user]);

  const deleteShift = useCallback(async (id: string) => {
    // 1. Optimistic local update
    setShifts(prev => prev.filter(s => s.id !== id));

    // 2. Cloud sync if logged in
    if (user) {
      const path = `users/${user.uid}/shifts/${id}`;
      try {
        setSyncStatus('syncing');
        await deleteDoc(doc(db, 'users', user.uid, 'shifts', id));
        setSyncStatus('synced');
        setLastSyncTime(new Date());
      } catch (error) {
        console.error("Failed to delete shift from Firestore:", error);
        setSyncStatus('error');
        try {
          handleFirestoreError(error, OperationType.DELETE, path);
        } catch (e) {
          // Logged
        }
      }
    }
  }, [user]);

  const addTransaction = useCallback(async (tx: Transaction) => {
    const cleaned = cleanTransaction(tx);

    // 1. Optimistic local update
    setTransactions(prev => [cleaned, ...prev.filter(t => t.id !== cleaned.id)]);

    // 2. Cloud sync if logged in
    if (user) {
      const path = `users/${user.uid}/transactions/${cleaned.id}`;
      try {
        setSyncStatus('syncing');
        await setDoc(doc(db, 'users', user.uid, 'transactions', cleaned.id), cleaned);
        setSyncStatus('synced');
        setLastSyncTime(new Date());
      } catch (error) {
        console.error("Failed to add transaction to Firestore:", error);
        setSyncStatus('error');
        try {
          handleFirestoreError(error, OperationType.CREATE, path);
        } catch (e) {
          // Logged
        }
      }
    }
  }, [user]);

  const deleteTransaction = useCallback(async (id: string) => {
    // 1. Optimistic local update
    setTransactions(prev => prev.filter(t => t.id !== id));

    // 2. Cloud sync if logged in
    if (user) {
      const path = `users/${user.uid}/transactions/${id}`;
      try {
        setSyncStatus('syncing');
        await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
        setSyncStatus('synced');
        setLastSyncTime(new Date());
      } catch (error) {
        console.error("Failed to delete transaction from Firestore:", error);
        setSyncStatus('error');
        try {
          handleFirestoreError(error, OperationType.DELETE, path);
        } catch (e) {
          // Logged
        }
      }
    }
  }, [user]);

  const updateSettings = useCallback(async (newSettings: UserSettings) => {
    const cleaned = cleanSettings(newSettings);

    // 1. Optimistic local update
    setSettings(cleaned);

    // 2. Cloud sync if logged in
    if (user) {
      const path = `users/${user.uid}`;
      try {
        setSyncStatus('syncing');
        await setDoc(doc(db, 'users', user.uid), cleaned, { merge: true });
        setSyncStatus('synced');
        setLastSyncTime(new Date());
      } catch (error) {
        console.error("Failed to update settings in Firestore:", error);
        setSyncStatus('error');
        try {
          handleFirestoreError(error, OperationType.UPDATE, path);
        } catch (e) {
          // Logged
        }
      }
    }
  }, [user]);

  return {
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
  };
}
