/**
 * Municipal QR Attendance - Authentication
 */

const Auth = {
  getSession() {
    const raw = sessionStorage.getItem(APP_CONFIG.sessionKey) ||
      localStorage.getItem(APP_CONFIG.sessionKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setSession(session, remember = false) {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(APP_CONFIG.sessionKey, JSON.stringify(session));
    if (remember) {
      localStorage.setItem(APP_CONFIG.rememberKey, 'true');
    }
  },

  clearSession() {
    sessionStorage.removeItem(APP_CONFIG.sessionKey);
    localStorage.removeItem(APP_CONFIG.sessionKey);
    localStorage.removeItem(APP_CONFIG.rememberKey);
  },

  isAuthenticated() {
    return !!this.getSession()?.token;
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      const base = this.getBasePath();
      window.location.href = base + 'index.html';
      return false;
    }
    return true;
  },

  getBasePath() {
    const path = window.location.pathname;
    if (path.includes('/pages/')) {
      return path.substring(0, path.indexOf('/pages/') + 1);
    }
    const lastSlash = path.lastIndexOf('/');
    return lastSlash >= 0 ? path.substring(0, lastSlash + 1) : '/';
  },

  getUser() {
    return this.getSession()?.user || null;
  },

  logout() {
    this.clearSession();
    window.location.href = this.getBasePath() + 'index.html';
  },

  async login(email, password, remember = false) {
    const result = await API.login(email, password);
    if (result.success) {
      this.setSession({
        token: result.token,
        user: result.user,
        loginTime: new Date().toISOString()
      }, remember);
    }
    return result;
  }
};
