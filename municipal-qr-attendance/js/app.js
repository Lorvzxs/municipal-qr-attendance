/**
 * Municipal QR Attendance - Shared Application Utilities
 */

const App = {
  formatDate(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const y = d.getFullYear();
    return `${m}/${day}/${y}`;
  },

  formatTime(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  },

  showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container position-fixed top-0 end-0 p-3';
      container.style.zIndex = '9999';
      document.body.appendChild(container);
    }

    const id = 'toast-' + Date.now();
    const bgClass = type === 'success' ? 'text-bg-success' :
      type === 'error' ? 'text-bg-danger' :
      type === 'warning' ? 'text-bg-warning' : 'text-bg-info';

    container.insertAdjacentHTML('beforeend', `
      <div id="${id}" class="toast align-items-center ${bgClass} border-0" role="alert">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>
    `);

    const toastEl = document.getElementById(id);
    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  },

  showLoading(show = true, text = 'Loading...') {
    let overlay = document.getElementById('global-loading');
    if (!overlay && show) {
      overlay = document.createElement('div');
      overlay.id = 'global-loading';
      overlay.className = 'global-loading';
      overlay.innerHTML = `
        <div class="loading-content">
          <div class="spinner-border text-light" role="status"></div>
          <p class="mt-3 mb-0">${text}</p>
        </div>`;
      document.body.appendChild(overlay);
    }
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
  },

  playSuccessSound() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.15);
      osc.start(this.audioCtx.currentTime);
      osc.stop(this.audioCtx.currentTime + 0.15);
    } catch {
      const audio = document.getElementById('success-sound');
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    }
  },

  playBeep() {
    this.playSuccessSound();
  },

  getStatusBadge(status) {
    const map = {
      COMPLETE: 'badge-complete',
      LATE: 'badge-late',
      UNDERTIME: 'badge-undertime',
      INCOMPLETE: 'badge-incomplete'
    };
    const cls = map[status] || 'badge-incomplete';
    return `<span class="badge ${cls}">${status || 'INCOMPLETE'}</span>`;
  },

  exportToCSV(data, filename) {
    if (!data || data.length === 0) {
      this.showToast('No data to export.', 'warning');
      return;
    }

    const headers = ['Office', 'Full Name', 'Date', 'AM IN', 'AM OUT', 'PM IN', 'PM OUT', 'Hours Rendered', 'Status'];
    const keys = ['office', 'fullName', 'date', 'amIn', 'amOut', 'pmIn', 'pmOut', 'hoursRendered', 'status'];

    const rows = [headers.join(',')];
    data.forEach(row => {
      rows.push(keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','));
    });

    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename || `attendance_${this.formatDate().replace(/\//g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  },

  printTable(title, data, summary) {
    const win = window.open('', '_blank');
    if (!win) {
      this.showToast('Please allow popups to print.', 'warning');
      return;
    }

    let html = `<html><head><title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #065f46; font-size: 18px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #065f46; color: white; }
        .summary { margin: 12px 0; font-size: 13px; }
      </style></head><body>`;

    html += `<h1>${APP_CONFIG.systemName}</h1>`;
    html += `<p>${APP_CONFIG.municipalityName}</p>`;
    html += `<h2>${title}</h2>`;

    if (summary) {
      html += `<div class="summary">
        Total: ${summary.totalRecords || data.length} |
        Complete: ${summary.complete || 0} |
        Late: ${summary.late || 0} |
        Undertime: ${summary.undertime || 0}
      </div>`;
    }

    html += `<table><thead><tr>
      <th>Office</th><th>Employee</th><th>Date</th>
      <th>AM IN</th><th>AM OUT</th><th>PM IN</th><th>PM OUT</th>
      <th>Hours</th><th>Status</th>
    </tr></thead><tbody>`;

    data.forEach(r => {
      html += `<tr>
        <td>${r.office || ''}</td><td>${r.fullName || ''}</td><td>${r.date || ''}</td>
        <td>${r.amIn || ''}</td><td>${r.amOut || ''}</td>
        <td>${r.pmIn || ''}</td><td>${r.pmOut || ''}</td>
        <td>${r.hoursRendered ?? ''}</td><td>${r.status || ''}</td>
      </tr>`;
    });

    html += '</tbody></table></body></html>';
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  },

  exportToPDF(title, data, summary) {
    this.printTable(title, data, summary);
  },

  initSidebar() {
    const user = Auth.getUser();
    const userNameEl = document.getElementById('sidebar-user-name');
    const userRoleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-avatar');

    if (userNameEl && user) userNameEl.textContent = user.fullName || user.email;
    if (userRoleEl && user) userRoleEl.textContent = user.role || 'User';
    if (avatarEl) {
      const base = Auth.getBasePath();
      avatarEl.src = base + 'assets/profiles/default-avatar.svg';
    }

    document.getElementById('logout-btn')?.addEventListener('click', e => {
      e.preventDefault();
      Auth.logout();
    });

    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
      if (link.getAttribute('href')?.includes(currentPage)) {
        link.classList.add('active');
      }
    });

    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-collapsed');
    });
  },

  async loadSettings(options = {}) {
    const apply = (data) => {
      if (!data) return;
      APP_CONFIG.municipalityName = data.municipalityName;
      APP_CONFIG.systemName = data.systemName;
      document.querySelectorAll('[data-system-name]').forEach((el) => {
        el.textContent = data.systemName;
      });
      document.querySelectorAll('[data-municipality-name]').forEach((el) => {
        el.textContent = data.municipalityName;
      });
    };

    const cached = API._getCached('settings') || API._loadSessionCache('settings');
    if (cached && cached.data) {
      apply(cached.data);
      if (options.background) return;
    }

    try {
      const result = await API.getSettings();
      if (result.success && result.data) apply(result.data);
    } catch { /* defaults */ }
  }
};
