/**
 * Municipal QR Attendance - API Client (JSONP + cache)
 */

const API = {
  _cache: {},
  _pending: {},

  getBaseUrl() {
    const stored = localStorage.getItem('mqams_api_url');
    return stored || API_CONFIG.BASE_URL;
  },

  setBaseUrl(url) {
    localStorage.setItem('mqams_api_url', url);
    this.clearCache();
  },

  isConfigured() {
    const baseUrl = this.getBaseUrl();
    return baseUrl && !baseUrl.includes('YOUR_GOOGLE') && baseUrl.includes('script.google.com');
  },

  clearCache(key) {
    if (key) {
      delete this._cache[key];
      return;
    }
    this._cache = {};
  },

  _getCached(key) {
    const entry = this._cache[key];
    if (!entry) return null;
    const ttl = (API_CONFIG.CACHE_TTL_MS && API_CONFIG.CACHE_TTL_MS[key]) || 60000;
    if (Date.now() - entry.ts > ttl) {
      delete this._cache[key];
      return null;
    }
    return entry.data;
  },

  _setCached(key, data) {
    this._cache[key] = { data, ts: Date.now() };
    try {
      sessionStorage.setItem('mqams_cache_' + key, JSON.stringify(this._cache[key]));
    } catch { /* quota */ }
  },

  _loadSessionCache(key) {
    try {
      const raw = sessionStorage.getItem('mqams_cache_' + key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      const ttl = (API_CONFIG.CACHE_TTL_MS && API_CONFIG.CACHE_TTL_MS[key]) || 60000;
      if (Date.now() - entry.ts > ttl) return null;
      this._cache[key] = entry;
      return entry.data;
    } catch {
      return null;
    }
  },

  request(action, params = {}, options = {}) {
    const baseUrl = this.getBaseUrl();
    if (!this.isConfigured()) {
      return Promise.reject(new Error('Please enter your Google Apps Script Web App URL on the login page.'));
    }

    const timeout = options.timeout || API_CONFIG.TIMEOUT || 30000;
    const dedupeKey = options.dedupeKey;

    if (dedupeKey && this._pending[dedupeKey]) {
      return this._pending[dedupeKey];
    }

    const promise = new Promise((resolve, reject) => {
      const callbackName = '_mqams_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      let script = null;

      const cleanup = () => {
        clearTimeout(timer);
        delete window[callbackName];
        if (script && script.parentNode) script.parentNode.removeChild(script);
        if (dedupeKey) delete this._pending[dedupeKey];
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Request timed out. Check your connection and Web App URL.'));
      }, timeout);

      window[callbackName] = (data) => {
        cleanup();
        resolve(data);
      };

      try {
        const url = new URL(baseUrl);
        url.searchParams.set('action', action);
        url.searchParams.set('callback', callbackName);

        Object.keys(params).forEach((key) => {
          const val = params[key];
          if (val !== undefined && val !== null && val !== '') {
            url.searchParams.set(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
          }
        });

        script = document.createElement('script');
        script.src = url.toString();
        script.async = true;
        script.onerror = () => {
          cleanup();
          reject(new Error('Failed to connect to server.'));
        };
        document.head.appendChild(script);
      } catch (err) {
        cleanup();
        reject(err);
      }
    });

    if (dedupeKey) this._pending[dedupeKey] = promise;
    return promise;
  },

  requestCached(action, params, cacheKey) {
    const cached = this._getCached(cacheKey) || this._loadSessionCache(cacheKey);
    if (cached) {
      return Promise.resolve(cached);
    }
    return this.request(action, params).then((result) => {
      if (result && result.success !== false) {
        this._setCached(cacheKey, result);
      }
      return result;
    });
  },

  login(email, password) {
    return this.request('login', { email, password }, { timeout: 15000 });
  },

  saveAttendance(qrData, scanType) {
    return this.request('saveAttendance', { qrData, scanType }, {
      timeout: API_CONFIG.SCAN_TIMEOUT || 12000,
      dedupeKey: 'scan_' + qrData + '_' + scanType
    });
  },

  getDashboard(date) {
    const key = 'dashboard_' + (date || '');
    const cached = this._getCached(key);
    if (cached) return Promise.resolve(cached);
    return this.request('dashboard', { date }).then((result) => {
      if (result && result.success) this._setCached(key, result);
      return result;
    });
  },

  getAttendance(params) {
    return this.request('attendance', params);
  },

  getReports(params) {
    return this.request('reports', params);
  },

  getSettings() {
    return this.requestCached('settings', {}, 'settings');
  },

  saveSettings(settings) {
    this.clearCache('settings');
    try { sessionStorage.removeItem('mqams_cache_settings'); } catch { /* */ }
    return this.request('settings', settings);
  },

  backupDatabase() {
    return this.request('backup');
  },

  restoreDatabase(data) {
    this.clearCache();
    return this.request('restore', { data: JSON.stringify(data) });
  },

  exportExcel(params) {
    return this.request('exportExcel', params);
  },

  exportPDF(params) {
    return this.request('exportPDF', params);
  }
};
