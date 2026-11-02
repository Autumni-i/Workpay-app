import { Shift, Transaction } from '../types';
import { formatCurrency } from './utils';
import firebaseConfig from '../../firebase-applet-config.json';

// Ensure you requested these scopes via set_up_oauth
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly'
].join(' ');

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;

// Load token from local storage on boot
try {
  const savedToken = localStorage.getItem('google_access_token');
  if (savedToken) {
    accessToken = savedToken;
  }
} catch (e) {
  console.error("Could not load saved token", e);
}

export function setGoogleAccessToken(token: string) {
  accessToken = token;
  try {
    localStorage.setItem('google_access_token', token);
  } catch (e) {
    // ignore
  }
  window.dispatchEvent(new CustomEvent('google-auth-success'));
}

export function clearGoogleAccessToken() {
  accessToken = null;
  try {
    localStorage.removeItem('google_access_token');
  } catch (e) {
    // ignore
  }
  window.dispatchEvent(new CustomEvent('google-auth-expired'));
}

export function initGoogleIdentity(clientId?: string) {
  const effectiveClientId = clientId || (firebaseConfig as any).oAuthClientId;
  if (!effectiveClientId) {
    // Graceful fallback to Firebase Auth popup if GIS Client ID is not explicitly set in config
    return;
  }

  if (!window.google?.accounts?.oauth2) {
    // Retry if script not loaded yet
    setTimeout(() => initGoogleIdentity(effectiveClientId), 200);
    return;
  }
  
  try {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: effectiveClientId,
      scope: SCOPES,
      callback: (response: google.accounts.oauth2.TokenResponse) => {
        if (response.error) {
          console.error('Error fetching token:', response);
          return;
        }
        if (response.access_token) {
          setGoogleAccessToken(response.access_token);
        }
      },
    });
  } catch (err) {
    console.error('Failed to initTokenClient:', err);
  }
}

export async function requestAccessToken() {
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
    return;
  }

  // Fallback to Firebase Google Auth popup which obtains OAuth token
  try {
    const { auth, googleProvider } = await import('./firebase');
    const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setGoogleAccessToken(credential.accessToken);
    }
  } catch (err: any) {
    console.error('Failed to request Google access via Firebase Auth:', err);
    throw new Error(err.message || 'Không thể đăng nhập Google Calendar');
  }
}

export function hasAccessToken() {
  return !!accessToken;
}

export async function exportToSheets(shifts: Shift[]): Promise<string> {
  if (!accessToken) throw new Error('Not authenticated');

  // 1. Create a new spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title: `Work Shifts Export - ${new Date().toLocaleDateString()}` }
    })
  });
  
  const spreadsheet = await createRes.json();
  const spreadsheetId = spreadsheet.spreadsheetId;

  // 2. Prepare data
  const values = [
    ['Date', 'Start Time', 'End Time', 'Hours', 'Hourly Rate', 'Total Pay', 'Notes'],
    ...shifts.map(s => [
      s.date, s.startTime, s.endTime, s.hoursWorked, s.hourlyRate, s.totalPay, s.notes || ''
    ])
  ];

  // 3. Update values
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:G${values.length}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values })
  });

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

export async function downloadAsExcel(shifts: Shift[]) {
  const XLSX = await import('xlsx');
  const data = shifts.map(s => ({
    Date: s.date,
    'Start Time': s.startTime,
    'End Time': s.endTime,
    'Hours Worked': s.hoursWorked,
    'Hourly Rate': s.hourlyRate,
    'Total Pay': s.totalPay,
    Notes: s.notes || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Shifts');
  XLSX.writeFile(workbook, `Work_Shifts_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function downloadAsCSV(shifts: Shift[]) {
  const headers = ['Date', 'Start Time', 'End Time', 'Hours Worked', 'Hourly Rate', 'Total Pay', 'Notes'];
  const rows = shifts.map(s => [
    s.date,
    s.startTime,
    s.endTime,
    s.hoursWorked.toString(),
    s.hourlyRate.toString(),
    s.totalPay.toString(),
    `"${(s.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(e => e.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Work_Shifts_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadMonthlyReportPDF(shifts: Shift[], transactions: Transaction[], month: string, currency: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);

  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(20);
  doc.text(`Monthly Financial Report - ${month}`, 14, 22);
  
  // Summary
  const monthlyShifts = shifts.filter(s => s.date.startsWith(month));
  const monthlyTx = transactions.filter(t => t.date.startsWith(month));
  
  const totalIncome = monthlyShifts.reduce((sum, s) => sum + s.totalPay, 0) + 
                      monthlyTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = monthlyTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  doc.setFontSize(12);
  doc.text(`Total Income: ${formatCurrency(totalIncome, currency)}`, 14, 35);
  doc.text(`Total Expenses: ${formatCurrency(totalExpense, currency)}`, 14, 42);
  doc.text(`Net Balance: ${formatCurrency(balance, currency)}`, 14, 49);

  // Shifts Table
  if (monthlyShifts.length > 0) {
    doc.text('Work Shifts', 14, 60);
    autoTable(doc, {
      startY: 65,
      head: [['Date', 'Time', 'Hours', 'Pay']],
      body: monthlyShifts.map(s => [
        s.date,
        `${s.startTime} - ${s.endTime}`,
        s.hoursWorked.toFixed(2),
        formatCurrency(s.totalPay, currency)
      ]),
    });
  }

  // Transactions Table
  if (monthlyTx.length > 0) {
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 65;
    doc.text('Transactions', 14, finalY);
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Date', 'Type', 'Category', 'Amount']],
      body: monthlyTx.map(t => [
        t.date,
        t.type === 'income' ? 'Income' : 'Expense',
        t.category || t.account || '-',
        formatCurrency(t.amount, currency)
      ]),
    });
  }

  doc.save(`Monthly_Report_${month}.pdf`);
}

export const GOOGLE_EVENT_COLORS: Record<string, { background: string; foreground: string; name: string }> = {
  '1': { background: '#7986cb', foreground: '#ffffff', name: 'Lavender (Xanh tím)' },
  '2': { background: '#33b679', foreground: '#ffffff', name: 'Sage (Xanh lá xô thơm)' },
  '3': { background: '#8e24aa', foreground: '#ffffff', name: 'Grape (Tím nho)' },
  '4': { background: '#e67c73', foreground: '#ffffff', name: 'Flamingo (Hồng hạc)' },
  '5': { background: '#f6bf26', foreground: '#1d1d1d', name: 'Banana (Vàng chuối)' },
  '6': { background: '#f4511e', foreground: '#ffffff', name: 'Tangerine (Cam)' },
  '7': { background: '#039be5', foreground: '#ffffff', name: 'Peacock (Xanh công)' },
  '8': { background: '#616161', foreground: '#ffffff', name: 'Graphite (Xám than)' },
  '9': { background: '#3f51b5', foreground: '#ffffff', name: 'Blueberry (Xanh việt quất)' },
  '10': { background: '#0b8043', foreground: '#ffffff', name: 'Basil (Xanh húng quế)' },
  '11': { background: '#d50000', foreground: '#ffffff', name: 'Tomato (Đỏ cà chua)' },
};

export const GOOGLE_CALENDAR_COLORS: Record<string, { background: string; foreground: string }> = {
  '1': { background: '#ac725e', foreground: '#ffffff' },
  '2': { background: '#d06b64', foreground: '#ffffff' },
  '3': { background: '#f83a22', foreground: '#ffffff' },
  '4': { background: '#fa573c', foreground: '#ffffff' },
  '5': { background: '#ff7537', foreground: '#ffffff' },
  '6': { background: '#ffad46', foreground: '#ffffff' },
  '7': { background: '#42d692', foreground: '#ffffff' },
  '8': { background: '#16a765', foreground: '#ffffff' },
  '9': { background: '#7bd148', foreground: '#ffffff' },
  '10': { background: '#b3dc6c', foreground: '#ffffff' },
  '11': { background: '#fbe983', foreground: '#1d1d1d' },
  '12': { background: '#fad165', foreground: '#1d1d1d' },
  '13': { background: '#92e1c0', foreground: '#1d1d1d' },
  '14': { background: '#9fe1e7', foreground: '#1d1d1d' },
  '15': { background: '#9fc6e7', foreground: '#1d1d1d' },
  '16': { background: '#4986e7', foreground: '#ffffff' },
  '17': { background: '#9a9cff', foreground: '#ffffff' },
  '18': { background: '#b99aff', foreground: '#ffffff' },
  '19': { background: '#c2c2c2', foreground: '#1d1d1d' },
  '20': { background: '#cabdbf', foreground: '#1d1d1d' },
  '21': { background: '#cca6ac', foreground: '#1d1d1d' },
  '22': { background: '#f691b2', foreground: '#ffffff' },
  '23': { background: '#cd74e6', foreground: '#ffffff' },
  '24': { background: '#a47ae2', foreground: '#ffffff' }
};

let cachedColorsData: any = null;
let cachedPrimaryCalendar: any = null;

export async function fetchCalendarColors() {
  if (!accessToken) return null;
  if (cachedColorsData) return cachedColorsData;
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/colors', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });
    if (res.ok) {
      cachedColorsData = await res.json();
      return cachedColorsData;
    }
  } catch (e) {
    console.warn('Could not fetch calendar colors from Google API, using standard mapping', e);
  }
  return null;
}

export async function fetchPrimaryCalendarInfo() {
  if (!accessToken) return null;
  if (cachedPrimaryCalendar) return cachedPrimaryCalendar;
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });
    if (res.ok) {
      cachedPrimaryCalendar = await res.json();
      return cachedPrimaryCalendar;
    }
  } catch (e) {
    console.warn('Could not fetch primary calendar info', e);
  }
  return null;
}

export async function fetchCalendarEvents(timeMin: string, timeMax: string) {
  if (!accessToken) throw new Error('Not authenticated');

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
  
  try {
    // Fetch events, colors, and primary calendar in parallel for maximum speed
    const [eventsRes, colorsData, primaryCal] = await Promise.all([
      fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }),
      fetchCalendarColors(),
      fetchPrimaryCalendarInfo()
    ]);

    if (eventsRes.status === 401 || eventsRes.status === 403) {
      clearGoogleAccessToken();
      throw new Error('Phiên kết nối Google Calendar đã hết hạn. Vui lòng kết nối lại.');
    }

    if (!eventsRes.ok) {
      const errorText = await eventsRes.text();
      console.error('Failed to fetch calendar events:', eventsRes.status, errorText);
      throw new Error(`Lỗi tải lịch (${eventsRes.status}): ${eventsRes.statusText}`);
    }

    const data = await eventsRes.json();
    const items = data.items || [];

    // Map each item to resolve its exact Google Calendar web color
    return items.map((item: any) => {
      let computedColor: string | undefined = undefined;
      let computedForegroundColor: string | undefined = undefined;

      // 1. If event has its own specific colorId set in Google Calendar
      if (item.colorId) {
        const dynamicColor = colorsData?.event?.[item.colorId];
        if (dynamicColor?.background) {
          computedColor = dynamicColor.background;
          computedForegroundColor = dynamicColor.foreground;
        } else if (GOOGLE_EVENT_COLORS[item.colorId]) {
          computedColor = GOOGLE_EVENT_COLORS[item.colorId].background;
          computedForegroundColor = GOOGLE_EVENT_COLORS[item.colorId].foreground;
        }
      }

      // 2. If event has no individual color, use primary calendar's default background color
      if (!computedColor && primaryCal) {
        if (primaryCal.backgroundColor) {
          computedColor = primaryCal.backgroundColor;
          computedForegroundColor = primaryCal.foregroundColor;
        } else if (primaryCal.colorId) {
          const dynamicCalColor = colorsData?.calendar?.[primaryCal.colorId];
          if (dynamicCalColor?.background) {
            computedColor = dynamicCalColor.background;
            computedForegroundColor = dynamicCalColor.foreground;
          } else if (GOOGLE_CALENDAR_COLORS[primaryCal.colorId]) {
            computedColor = GOOGLE_CALENDAR_COLORS[primaryCal.colorId].background;
            computedForegroundColor = GOOGLE_CALENDAR_COLORS[primaryCal.colorId].foreground;
          }
        }
      }

      return {
        ...item,
        computedColor,
        computedForegroundColor
      };
    });
  } catch (err: any) {
    if (err.message && err.message.includes('Phiên kết nối')) {
      throw err;
    }
    // If it's a TypeError like Failed to fetch (network error / CORS), rethrow friendly error
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      clearGoogleAccessToken();
      throw new Error('Không thể kết nối đến Google Calendar (có thể do phiên đăng nhập hết hạn hoặc sự cố mạng). Vui lòng bấm Kết nối lại.');
    }
    throw err;
  }
}

export async function addShiftToCalendar(shift: Shift, currency: string = 'VND') {
  if (!accessToken) throw new Error('Not authenticated');

  // Convert local date and time to ISO strings
  const startDateTime = new Date(`${shift.date}T${shift.startTime}:00`).toISOString();
  // Handle end time on the next day if necessary
  let endDateTimeObj = new Date(`${shift.date}T${shift.endTime}:00`);
  if (shift.endTime < shift.startTime) {
    endDateTimeObj.setDate(endDateTimeObj.getDate() + 1);
  }
  const endDateTime = endDateTimeObj.toISOString();

  const formattedPay = formatCurrency(shift.totalPay, currency);

  const event = {
    summary: `Ca làm việc (${shift.hoursWorked.toFixed(1)}h) - Workpay`,
    description: `• Thời gian: ${shift.startTime} - ${shift.endTime} (${shift.hoursWorked.toFixed(1)}h)\n• Thu nhập tạm tính: ${formattedPay}\n• Ghi chú: ${shift.notes || 'Không có'}\n\n[Được đồng bộ từ ứng dụng Workpay]`,
    start: {
      dateTime: startDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    colorId: '5' // Banana / Yellow color in Google Calendar
  };

  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event)
    });

    if (response.status === 401 || response.status === 403) {
      clearGoogleAccessToken();
      throw new Error('Phiên kết nối Google Calendar đã hết hạn. Vui lòng kết nối lại.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create calendar event:', response.status, errorText);
      throw new Error('Không thể thêm ca làm việc vào Google Calendar');
    }

    return response.json();
  } catch (err: any) {
    if (err.message && err.message.includes('Phiên kết nối')) {
      throw err;
    }
    throw err;
  }
}

export async function deleteGoogleCalendarEvent(eventId: string) {
  if (!accessToken) throw new Error('Not authenticated');

  try {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    if (response.status === 401 || response.status === 403) {
      clearGoogleAccessToken();
      throw new Error('Phiên kết nối Google Calendar đã hết hạn. Vui lòng kết nối lại.');
    }

    if (!response.ok && response.status !== 204 && response.status !== 404 && response.status !== 410) {
      const errorText = await response.text();
      console.error('Failed to delete calendar event:', response.status, errorText);
      throw new Error(`Không thể xóa sự kiện Google Calendar (${response.status})`);
    }

    return true;
  } catch (err: any) {
    if (err.message && err.message.includes('Phiên kết nối')) {
      throw err;
    }
    throw err;
  }
}
