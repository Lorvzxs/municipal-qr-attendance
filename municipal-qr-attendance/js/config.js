/**
 * API Configuration
 */
const API_CONFIG = {
  BASE_URL: 'https://script.google.com/macros/s/AKfycbwAi5bzu8zBl2BPfXLLgfvFCZouz1pcZop7LSEktX91JpvQsqvRIBx71kc-9A27iNWs/exec',
  TIMEOUT: 30000,
  SCAN_TIMEOUT: 12000,
  CACHE_TTL_MS: {
    settings: 5 * 60 * 1000,
    dashboard: 60 * 1000
  }
};

const APP_CONFIG = {
  municipalityName: 'Municipality of Asuncion, Davao del Norte',
  systemName: 'Municipal QR Attendance Management System',
  sessionKey: 'mqams_session',
  rememberKey: 'mqams_remember'
};
