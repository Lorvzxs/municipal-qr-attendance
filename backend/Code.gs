/**
 * Municipal QR Attendance Management System
 * Municipality of Asuncion, Davao del Norte
 * Google Apps Script Web App API Backend
 */

const CONFIG = {
  SPREADSHEET_NAME: 'Municipal QR Attendance Database',
  ATTENDANCE_SHEET: 'Attendance',
  USERS_SHEET: 'Users',
  SETTINGS_SHEET: 'Settings',
  BACKUP_SHEET: 'Backup',
  DEFAULT_LATE_THRESHOLD: '08:00 AM',
  DEFAULT_REQUIRED_HOURS: 8,
  DEFAULT_MUNICIPALITY: 'Municipality of Asuncion, Davao del Norte',
  DEFAULT_SYSTEM_NAME: 'Municipal QR Attendance Management System'
};

const ATTENDANCE_HEADERS = [
  'Office', 'Full Name', 'Date', 'AM IN', 'AM OUT', 'PM IN', 'PM OUT',
  'Hours Rendered', 'Status', 'Created At', 'Updated At'
];

const USER_HEADERS = ['Email', 'Password', 'Role', 'Full Name'];

const SETTINGS_HEADERS = [
  'Municipality Name', 'System Name', 'Late Threshold', 'Required Working Hours'
];

// ─── Sheet helpers (getRange row,col,numRows,numCols — NOT end row!) ─────────

function setRowValues(sheet, row, values) {
  sheet.getRange(row, 1, values.length).setValues([values]);
}

function setRowsValues(sheet, startRow, values2d) {
  if (!values2d || values2d.length === 0) return;
  sheet.getRange(startRow, 1, values2d.length, values2d[0].length).setValues(values2d);
}

function getRowValues(sheet, row, numCols) {
  return sheet.getRange(row, 1, numCols).getValues()[0];
}

// ─── HTTP Handlers ───────────────────────────────────────────────────────────

function doGet(e) {
  return respond(e, processRequest(e, 'GET'));
}

function doPost(e) {
  return respond(e, processRequest(e, 'POST'));
}

function respond(e, result) {
  const callback = e && e.parameter && e.parameter.callback;
  return jsonResponse(result, callback);
}

function processRequest(e, method) {
  try {
    const params = method === 'POST' ? parsePostData(e) : (e.parameter || {});
    const action = (params.action || '').toLowerCase();
    let result;

    switch (action) {
      case 'login':
        result = loginUser(params.email, params.password);
        break;
      case 'saveattendance':
        result = handleSaveAttendance(params);
        break;
      case 'dashboard':
        result = getDashboardStats(params.date);
        break;
      case 'attendance':
        result = getAttendanceRecords(params);
        break;
      case 'reports':
        result = getReports(params);
        break;
      case 'settings':
        result = params.municipalityName !== undefined ? saveSettings(params) : getSettings();
        break;
      case 'backup':
        result = backupDatabase();
        break;
      case 'restore':
        result = restoreDatabase(params.data);
        break;
      case 'exportexcel':
        result = exportExcel(params);
        break;
      case 'exportpdf':
        result = exportPDF(params);
        break;
      case 'setup':
        result = setupDatabase();
        break;
      case '':
        result = {
          success: true,
          message: 'Municipal QR Attendance API is running.',
          hint: 'Use ?action=setup to initialize, or open the frontend login page to use the system.',
          actions: ['login', 'saveAttendance', 'dashboard', 'attendance', 'reports', 'settings', 'setup']
        };
        break;
      default:
        result = { success: false, message: 'Invalid action: ' + action };
    }

    return result;
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

// Legacy alias
function handleRequest(e, method) {
  return respond(e, processRequest(e, method));
}

function parsePostData(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return e ? (e.parameter || {}) : {};
  }
  try {
    const body = JSON.parse(e.postData.contents);
    return Object.assign({}, e.parameter || {}, body);
  } catch (parseErr) {
    return e.parameter || {};
  }
}

function jsonResponse(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    // JSONP — bypasses browser CORS restrictions for cross-origin requests
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Spreadsheet Access ──────────────────────────────────────────────────────

function getSpreadsheet() {
  const files = DriveApp.getFilesByName(CONFIG.SPREADSHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  return initializeSpreadsheet();
}

function initializeSpreadsheet() {
  const ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
  const attendance = ss.getSheets()[0];
  attendance.setName(CONFIG.ATTENDANCE_SHEET);
  setRowValues(attendance, 1, ATTENDANCE_HEADERS);
  attendance.getRange(1, 1, 1, ATTENDANCE_HEADERS.length).setFontWeight('bold');

  const users = ss.insertSheet(CONFIG.USERS_SHEET);
  setRowValues(users, 1, USER_HEADERS);
  users.getRange(1, 1, 1, USER_HEADERS.length).setFontWeight('bold');
  setRowValues(users, 2, [
    'admin@asuncion.gov', 'Asuncion@2026', 'Administrator', 'System Administrator'
  ]);

  const settings = ss.insertSheet(CONFIG.SETTINGS_SHEET);
  setRowValues(settings, 1, SETTINGS_HEADERS);
  settings.getRange(1, 1, 1, SETTINGS_HEADERS.length).setFontWeight('bold');
  setRowValues(settings, 2, [
    CONFIG.DEFAULT_MUNICIPALITY,
    CONFIG.DEFAULT_SYSTEM_NAME,
    CONFIG.DEFAULT_LATE_THRESHOLD,
    CONFIG.DEFAULT_REQUIRED_HOURS
  ]);

  ss.insertSheet(CONFIG.BACKUP_SHEET).hideSheet();

  return ss;
}

function setupDatabase() {
  ensureDefaultUsers();
  getSheet(CONFIG.ATTENDANCE_SHEET);
  getSheet(CONFIG.SETTINGS_SHEET);
  getSheet(CONFIG.BACKUP_SHEET);
  return {
    success: true,
    message: 'Database initialized. Default admin: admin@asuncion.gov / Asuncion@2026',
    spreadsheetUrl: getSpreadsheet().getUrl()
  };
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    if (name === CONFIG.ATTENDANCE_SHEET) {
      sheet = ss.insertSheet(name);
      setRowValues(sheet, 1, ATTENDANCE_HEADERS);
    } else if (name === CONFIG.USERS_SHEET) {
      sheet = ss.insertSheet(name);
      setRowValues(sheet, 1, USER_HEADERS);
      setRowValues(sheet, 2, [
        'admin@asuncion.gov', 'Asuncion@2026', 'Administrator', 'System Administrator'
      ]);
    } else if (name === CONFIG.SETTINGS_SHEET) {
      sheet = ss.insertSheet(name);
      setRowValues(sheet, 1, SETTINGS_HEADERS);
      setRowValues(sheet, 2, [
        CONFIG.DEFAULT_MUNICIPALITY,
        CONFIG.DEFAULT_SYSTEM_NAME,
        CONFIG.DEFAULT_LATE_THRESHOLD,
        CONFIG.DEFAULT_REQUIRED_HOURS
      ]);
    } else if (name === CONFIG.BACKUP_SHEET) {
      sheet = ss.insertSheet(name);
      sheet.hideSheet();
    }
  }
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).filter(function (row) {
    return row.some(function (cell) { return cell !== '' && cell !== null; });
  }).map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

// ─── Authentication ──────────────────────────────────────────────────────────

function ensureDefaultUsers() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.USERS_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.USERS_SHEET);
    setRowValues(sheet, 1, USER_HEADERS);
    sheet.getRange(1, 1, 1, USER_HEADERS.length).setFontWeight('bold');
  }

  if (sheet.getLastRow() < 2) {
    setRowValues(sheet, 2, [
      'admin@asuncion.gov', 'Asuncion@2026', 'Administrator', 'System Administrator'
    ]);
  }
}

function loginUser(email, password) {
  email = String(email || '').trim();
  password = String(password || '').trim();

  if (!email || !password) {
    return { success: false, message: 'Email and password are required.' };
  }

  ensureDefaultUsers();

  const sheet = getSheet(CONFIG.USERS_SHEET);
  const users = sheetToObjects(sheet);
  const user = users.find(function (u) {
    return String(u['Email'] || '').trim().toLowerCase() === email.toLowerCase() &&
      String(u['Password'] || '').trim() === password;
  });

  if (!user) {
    return {
      success: false,
      message: 'Invalid email or password. Verify the Users sheet in Google Sheets matches your credentials.'
    };
  }

  const token = Utilities.base64Encode(
    email + ':' + new Date().getTime() + ':' + Utilities.getUuid()
  );

  return {
    success: true,
    message: 'Login successful.',
    token: token,
    user: {
      email: user['Email'],
      role: user['Role'],
      fullName: user['Full Name']
    }
  };
}

// ─── QR Parsing ──────────────────────────────────────────────────────────────

function parseQRCode(qrData) {
  if (!qrData || typeof qrData !== 'string') {
    throw new Error('Invalid QR code data.');
  }

  const trimmed = qrData.trim();
  const dashIndex = trimmed.indexOf('-');
  if (dashIndex === -1) {
    throw new Error('Invalid QR format. Expected: OFFICE-FULLNAME');
  }

  const office = trimmed.substring(0, dashIndex).trim();
  const fullName = trimmed.substring(dashIndex + 1).trim();

  if (!office || !fullName) {
    throw new Error('Invalid QR format. Office and Full Name are required.');
  }

  return { office: office, fullName: fullName };
}

function findAttendanceRow(sheet, fullName, dateStr) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const rows = sheet.getRange(2, 2, lastRow, 3).getValues();
  const nameKey = String(fullName).trim().toUpperCase();

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === nameKey &&
        normalizeDateString(rows[i][1]) === dateStr) {
      return i + 2;
    }
  }
  return -1;
}

function getSettingsDataCached() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('mqams_settings');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) { /* refresh */ }
  }
  const data = getSettingsData();
  cache.put('mqams_settings', JSON.stringify(data), 300);
  return data;
}

// ─── Attendance Core ─────────────────────────────────────────────────────────

function saveAttendance(qrData, scanType) {
  return recordAttendance(qrData, scanType);
}

function recordAttendance(qrData, scanType) {
  const validTypes = ['AM IN', 'AM OUT', 'PM IN', 'PM OUT'];
  if (validTypes.indexOf(scanType) === -1) {
    return { success: false, message: 'Invalid attendance type.' };
  }

  const parsed = parseQRCode(qrData);
  const sheet = getSheet(CONFIG.ATTENDANCE_SHEET);
  const settings = getSettingsDataCached();
  const now = new Date();
  const dateStr = formatDate(now);
  const timeStr = formatTime(now);
  const timestamp = formatDateTime(now);

  let rowIndex = findAttendanceRow(sheet, parsed.fullName, dateStr);

  const colMap = { 'AM IN': 4, 'AM OUT': 5, 'PM IN': 6, 'PM OUT': 7 };

  if (rowIndex === -1) {
    const newRow = [
      parsed.office,
      parsed.fullName,
      dateStr,
      '', '', '', '',
      0,
      'INCOMPLETE',
      timestamp,
      timestamp
    ];
    newRow[colMap[scanType] - 1] = timeStr;
    sheet.appendRow(newRow);
    rowIndex = sheet.getLastRow();
  } else {
    sheet.getRange(rowIndex, colMap[scanType]).setValue(timeStr);
    sheet.getRange(rowIndex, 11).setValue(timestamp);
  }

  return updateAttendanceRow(sheet, rowIndex, settings);
}

function updateAttendance(sheet, rowIndex, settings) {
  return updateAttendanceRow(sheet, rowIndex, settings || getSettingsData());
}

function updateAttendanceRow(sheet, rowIndex, settings) {
  const row = getRowValues(sheet, rowIndex, 11);
  const amIn = row[3];
  const amOut = row[4];
  const pmIn = row[5];
  const pmOut = row[6];

  const hours = calculateHoursRendered(amIn, amOut, pmIn, pmOut);
  const status = calculateStatus(amIn, amOut, pmIn, pmOut, hours, settings);

  sheet.getRange(rowIndex, 8).setValue(hours);
  sheet.getRange(rowIndex, 9).setValue(status);
  sheet.getRange(rowIndex, 11).setValue(formatDateTime(new Date()));

  return {
    success: true,
    message: 'Attendance recorded successfully.',
    data: {
      office: row[0],
      fullName: row[1],
      date: normalizeDateString(row[2]),
      amIn: formatTimeDisplay(amIn),
      amOut: formatTimeDisplay(amOut),
      pmIn: formatTimeDisplay(pmIn),
      pmOut: formatTimeDisplay(pmOut),
      hoursRendered: hours,
      status: status
    }
  };
}

function handleSaveAttendance(params) {
  if (!params.qrData && !params.qr) {
    return { success: false, message: 'QR code data is required.' };
  }
  const qrData = params.qrData || params.qr;
  const scanType = params.scanType || params.type;
  return recordAttendance(qrData, scanType);
}

function calculateHoursRendered(amIn, amOut, pmIn, pmOut) {
  let totalMinutes = 0;
  totalMinutes += timeDiffMinutes(amIn, amOut);
  totalMinutes += timeDiffMinutes(pmIn, pmOut);
  return Math.round((totalMinutes / 60) * 100) / 100;
}

function calculateStatus(amIn, amOut, pmIn, pmOut, hours, settings) {
  const requiredHours = settings.requiredWorkingHours || CONFIG.DEFAULT_REQUIRED_HOURS;
  const lateThreshold = settings.lateThreshold || CONFIG.DEFAULT_LATE_THRESHOLD;

  const hasAmIn = !isEmptyTime(amIn);
  const hasAmOut = !isEmptyTime(amOut);
  const hasPmIn = !isEmptyTime(pmIn);
  const hasPmOut = !isEmptyTime(pmOut);

  if (!hasAmIn || !hasAmOut || !hasPmIn || !hasPmOut) {
    return 'INCOMPLETE';
  }

  if (hours < requiredHours) {
    return 'UNDERTIME';
  }

  if (hasAmIn && isTimeAfter(amIn, lateThreshold)) {
    return 'LATE';
  }

  return 'COMPLETE';
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

function getDashboardStats(dateParam) {
  const targetDate = dateParam || formatDate(new Date());
  const records = getAllAttendanceRecords();
  const todayRecords = records.filter(function (r) {
    return normalizeDateString(r.date) === targetDate;
  });

  const stats = {
    presentToday: 0,
    lateToday: 0,
    undertime: 0,
    completeAttendance: 0,
    incompleteAttendance: 0,
    totalQRScans: 0,
    averageHoursRendered: 0,
    activeOffices: 0,
    attendanceTrend: [],
    dailyAttendance: { labels: [], data: [] },
    officeSummary: { labels: [], data: [] },
    monthlyAttendance: { labels: [], data: [] },
    recentAttendance: []
  };

  if (todayRecords.length === 0) {
    return { success: true, data: stats };
  }

  const offices = {};
  let totalHours = 0;
  let hoursCount = 0;

  todayRecords.forEach(function (r) {
    const hasAnyScan = r.amIn || r.amOut || r.pmIn || r.pmOut;
    if (hasAnyScan) stats.presentToday++;

    if (r.status === 'LATE') stats.lateToday++;
    if (r.status === 'UNDERTIME') stats.undertime++;
    if (r.status === 'COMPLETE') stats.completeAttendance++;
    if (r.status === 'INCOMPLETE') stats.incompleteAttendance++;

    stats.totalQRScans += countScans(r);

    if (r.hoursRendered > 0) {
      totalHours += parseFloat(r.hoursRendered);
      hoursCount++;
    }

    if (r.office) {
      offices[r.office] = (offices[r.office] || 0) + 1;
    }
  });

  stats.averageHoursRendered = hoursCount > 0
    ? Math.round((totalHours / hoursCount) * 100) / 100
    : 0;
  stats.activeOffices = Object.keys(offices).length;

  stats.officeSummary.labels = Object.keys(offices);
  stats.officeSummary.data = Object.keys(offices).map(function (k) { return offices[k]; });

  stats.attendanceTrend = buildAttendanceTrend(records, 7);
  stats.dailyAttendance = buildDailyAttendance(records, 7);
  stats.monthlyAttendance = buildMonthlyAttendance(records);

  stats.recentAttendance = todayRecords
    .sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    })
    .slice(0, 10);

  return { success: true, data: stats };
}

function countScans(record) {
  let count = 0;
  if (record.amIn) count++;
  if (record.amOut) count++;
  if (record.pmIn) count++;
  if (record.pmOut) count++;
  return count;
}

function buildAttendanceTrend(records, days) {
  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    const dayRecords = records.filter(function (r) {
      return normalizeDateString(r.date) === dateStr;
    });
    result.push({
      date: dateStr,
      present: dayRecords.filter(function (r) { return r.amIn || r.amOut || r.pmIn || r.pmOut; }).length,
      late: dayRecords.filter(function (r) { return r.status === 'LATE'; }).length,
      complete: dayRecords.filter(function (r) { return r.status === 'COMPLETE'; }).length
    });
  }
  return result;
}

function buildDailyAttendance(records, days) {
  const trend = buildAttendanceTrend(records, days);
  return {
    labels: trend.map(function (t) { return t.date; }),
    data: trend.map(function (t) { return t.present; })
  };
}

function buildMonthlyAttendance(records) {
  const months = {};
  records.forEach(function (r) {
    const d = normalizeDateString(r.date);
    if (!d) return;
    const parts = d.split('/');
    const key = parts.length >= 3 ? parts[2] + '-' + parts[0] : d.substring(0, 7);
    months[key] = (months[key] || 0) + 1;
  });
  const keys = Object.keys(months).sort();
  return {
    labels: keys,
    data: keys.map(function (k) { return months[k]; })
  };
}

// ─── Attendance Records ──────────────────────────────────────────────────────

function getAttendanceRecords(params) {
  params = params || {};
  let records = getAllAttendanceRecords();

  if (params.search) {
    const q = params.search.toLowerCase();
    records = records.filter(function (r) {
      return String(r.fullName).toLowerCase().indexOf(q) !== -1 ||
        String(r.office).toLowerCase().indexOf(q) !== -1;
    });
  }

  if (params.office && params.office !== 'all') {
    records = records.filter(function (r) {
      return String(r.office).toUpperCase() === String(params.office).toUpperCase();
    });
  }

  if (params.date) {
    records = records.filter(function (r) {
      return normalizeDateString(r.date) === params.date;
    });
  }

  if (params.month) {
    records = records.filter(function (r) {
      const d = normalizeDateString(r.date);
      return d && d.indexOf(params.month) !== -1;
    });
  }

  if (params.view === 'monthly' && params.year && params.monthNum) {
    records = records.filter(function (r) {
      const d = normalizeDateString(r.date);
      if (!d) return false;
      const parts = d.split('/');
      return parts[2] === String(params.year) && parts[0] === padZero(params.monthNum);
    });
  }

  records.sort(function (a, b) {
    const dateCompare = new Date(b.date) - new Date(a.date);
    if (dateCompare !== 0) return dateCompare;
    return String(a.fullName).localeCompare(String(b.fullName));
  });

  return { success: true, data: records, total: records.length };
}

function getAllAttendanceRecords() {
  const sheet = getSheet(CONFIG.ATTENDANCE_SHEET);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  return data.slice(1).filter(function (row) {
    return row[1];
  }).map(function (row) {
    return {
      office: row[0],
      fullName: row[1],
      date: normalizeDateString(row[2]),
      amIn: formatTimeDisplay(row[3]),
      amOut: formatTimeDisplay(row[4]),
      pmIn: formatTimeDisplay(row[5]),
      pmOut: formatTimeDisplay(row[6]),
      hoursRendered: parseFloat(row[7]) || 0,
      status: row[8] || 'INCOMPLETE',
      createdAt: row[9] ? String(row[9]) : '',
      updatedAt: row[10] ? String(row[10]) : ''
    };
  });
}

function getUniqueOffices() {
  const records = getAllAttendanceRecords();
  const offices = {};
  records.forEach(function (r) {
    if (r.office) offices[r.office] = true;
  });
  return Object.keys(offices).sort();
}

// ─── Reports ─────────────────────────────────────────────────────────────────

function getReports(params) {
  params = params || {};
  const reportType = (params.reportType || 'daily').toLowerCase();
  let records = getAllAttendanceRecords();
  const today = new Date();

  switch (reportType) {
    case 'daily':
      records = filterByDate(records, params.date || formatDate(today));
      break;
    case 'weekly':
      records = filterByWeek(records, params.date || formatDate(today));
      break;
    case 'monthly':
      records = filterByMonth(records, params.year || today.getFullYear(), params.month || (today.getMonth() + 1));
      break;
    case 'yearly':
      records = filterByYear(records, params.year || today.getFullYear());
      break;
    case 'office':
      records = params.office
        ? records.filter(function (r) { return String(r.office).toUpperCase() === String(params.office).toUpperCase(); })
        : records;
      if (params.date) records = filterByDate(records, params.date);
      break;
    case 'late':
      records = records.filter(function (r) { return r.status === 'LATE'; });
      if (params.date) records = filterByDate(records, params.date);
      break;
    case 'undertime':
      records = records.filter(function (r) { return r.status === 'UNDERTIME'; });
      if (params.date) records = filterByDate(records, params.date);
      break;
  }

  const summary = {
    totalRecords: records.length,
    complete: records.filter(function (r) { return r.status === 'COMPLETE'; }).length,
    late: records.filter(function (r) { return r.status === 'LATE'; }).length,
    undertime: records.filter(function (r) { return r.status === 'UNDERTIME'; }).length,
    incomplete: records.filter(function (r) { return r.status === 'INCOMPLETE'; }).length,
    totalHours: records.reduce(function (sum, r) { return sum + (parseFloat(r.hoursRendered) || 0); }, 0)
  };

  return {
    success: true,
    reportType: reportType,
    data: records,
    summary: summary,
    offices: getUniqueOffices()
  };
}

function getMonthlyReport(year, month) {
  return getReports({ reportType: 'monthly', year: year, month: month });
}

function filterByDate(records, dateStr) {
  return records.filter(function (r) {
    return normalizeDateString(r.date) === dateStr;
  });
}

function filterByWeek(records, dateStr) {
  const target = parseDateString(dateStr);
  const weekStart = new Date(target);
  weekStart.setDate(target.getDate() - target.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return records.filter(function (r) {
    const d = parseDateString(normalizeDateString(r.date));
    return d >= weekStart && d <= weekEnd;
  });
}

function filterByMonth(records, year, month) {
  return records.filter(function (r) {
    const d = parseDateString(normalizeDateString(r.date));
    return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
  });
}

function filterByYear(records, year) {
  return records.filter(function (r) {
    const d = parseDateString(normalizeDateString(r.date));
    return d.getFullYear() === parseInt(year);
  });
}

// ─── Settings ────────────────────────────────────────────────────────────────

function getSettings() {
  return { success: true, data: getSettingsData() };
}

function getSettingsData() {
  const sheet = getSheet(CONFIG.SETTINGS_SHEET);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return {
      municipalityName: CONFIG.DEFAULT_MUNICIPALITY,
      systemName: CONFIG.DEFAULT_SYSTEM_NAME,
      lateThreshold: CONFIG.DEFAULT_LATE_THRESHOLD,
      requiredWorkingHours: CONFIG.DEFAULT_REQUIRED_HOURS
    };
  }
  return {
    municipalityName: data[1][0] || CONFIG.DEFAULT_MUNICIPALITY,
    systemName: data[1][1] || CONFIG.DEFAULT_SYSTEM_NAME,
    lateThreshold: formatTimeDisplay(data[1][2]) || CONFIG.DEFAULT_LATE_THRESHOLD,
    requiredWorkingHours: parseFloat(data[1][3]) || CONFIG.DEFAULT_REQUIRED_HOURS
  };
}

function saveSettings(params) {
  const sheet = getSheet(CONFIG.SETTINGS_SHEET);
  setRowValues(sheet, 2, [
    params.municipalityName || CONFIG.DEFAULT_MUNICIPALITY,
    params.systemName || CONFIG.DEFAULT_SYSTEM_NAME,
    params.lateThreshold || CONFIG.DEFAULT_LATE_THRESHOLD,
    parseFloat(params.requiredWorkingHours) || CONFIG.DEFAULT_REQUIRED_HOURS
  ]);

  CacheService.getScriptCache().remove('mqams_settings');

  return { success: true, message: 'Settings saved successfully.', data: getSettingsData() };
}

// ─── Backup & Restore ────────────────────────────────────────────────────────

function backupDatabase() {
  const ss = getSpreadsheet();
  const backup = {
    timestamp: formatDateTime(new Date()),
    attendance: sheetToObjects(getSheet(CONFIG.ATTENDANCE_SHEET)),
    users: sheetToObjects(getSheet(CONFIG.USERS_SHEET)),
    settings: sheetToObjects(getSheet(CONFIG.SETTINGS_SHEET))
  };

  const backupSheet = getSheet(CONFIG.BACKUP_SHEET);
  backupSheet.clear();
  backupSheet.getRange(1, 1).setValue(JSON.stringify(backup));

  return { success: true, message: 'Backup created successfully.', data: backup };
}

function restoreDatabase(dataStr) {
  if (!dataStr) {
    return { success: false, message: 'No backup data provided.' };
  }

  let backup;
  try {
    backup = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
  } catch (e) {
    return { success: false, message: 'Invalid backup data format.' };
  }

  if (backup.attendance) restoreSheetData(CONFIG.ATTENDANCE_SHEET, ATTENDANCE_HEADERS, backup.attendance);
  if (backup.settings) restoreSheetData(CONFIG.SETTINGS_SHEET, SETTINGS_HEADERS, backup.settings);

  return { success: true, message: 'Database restored successfully.' };
}

function restoreSheetData(sheetName, headers, rows) {
  const sheet = getSheet(sheetName);
  sheet.clear();
  setRowValues(sheet, 1, headers);
  if (rows.length === 0) return;

  const values = rows.map(function (row) {
    return headers.map(function (h) { return row[h] !== undefined ? row[h] : ''; });
  });
  setRowsValues(sheet, 2, values);
}

// ─── Export ──────────────────────────────────────────────────────────────────

function exportExcel(params) {
  const result = params.reportType
    ? getReports(params)
    : getAttendanceRecords(params);
  return {
    success: true,
    data: result.data,
    summary: result.summary || null,
    filename: 'attendance_export_' + formatDate(new Date()).replace(/\//g, '-') + '.csv'
  };
}

function exportPDF(params) {
  const result = params.reportType
    ? getReports(params)
    : getAttendanceRecords(params);
  return {
    success: true,
    data: result.data,
    summary: result.summary || null,
    settings: getSettingsData()
  };
}

// ─── Time Utilities ──────────────────────────────────────────────────────────

function formatDate(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  return padZero(m) + '/' + padZero(d) + '/' + y;
}

function formatTime(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return padZero(hours) + ':' + padZero(minutes) + ' ' + ampm;
}

function formatDateTime(date) {
  return formatDate(date) + ' ' + formatTime(date);
}

function formatTimeDisplay(value) {
  if (!value || value === '') return '';
  if (value instanceof Date) return formatTime(value);
  return String(value);
}

function normalizeDateString(value) {
  if (!value) return '';
  if (value instanceof Date) return formatDate(value);
  return String(value);
}

function parseDateString(dateStr) {
  if (!dateStr) return new Date();
  const parts = String(dateStr).split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
  }
  return new Date(dateStr);
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr || timeStr === '') return null;
  if (timeStr instanceof Date) {
    return timeStr.getHours() * 60 + timeStr.getMinutes();
  }

  const str = String(timeStr).trim().toUpperCase();
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) {
    const d = new Date('1970/01/01 ' + str);
    if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
    return null;
  }

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3];

  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function timeDiffMinutes(start, end) {
  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);
  if (startMin === null || endMin === null) return 0;
  if (endMin <= startMin) return 0;
  return endMin - startMin;
}

function isEmptyTime(value) {
  return !value || String(value).trim() === '';
}

function isTimeAfter(timeStr, thresholdStr) {
  const timeMin = parseTimeToMinutes(timeStr);
  const thresholdMin = parseTimeToMinutes(thresholdStr);
  if (timeMin === null || thresholdMin === null) return false;
  return timeMin > thresholdMin;
}

function padZero(num) {
  return num < 10 ? '0' + num : String(num);
}
