/**
 * Attendance Records Page
 */

const Attendance = {
  records: [],

  async init() {
    if (!Auth.requireAuth()) return;
    App.initSidebar();
    App.loadSettings({ background: true });

    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    const today = new Date();
    document.getElementById('filter-date').value = today.toISOString().split('T')[0];
    document.getElementById('filter-month').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    document.getElementById('view-type').addEventListener('change', () => this.toggleViewFilters());
    document.getElementById('btn-filter').addEventListener('click', () => this.loadRecords());
    document.getElementById('btn-export-excel').addEventListener('click', () => this.exportExcel());
    document.getElementById('btn-export-pdf').addEventListener('click', () => this.exportPDF());
    document.getElementById('btn-print').addEventListener('click', () => this.printRecords());

    await this.loadOffices();
    await this.loadRecords();
  },

  toggleViewFilters() {
    const view = document.getElementById('view-type').value;
    document.getElementById('filter-date-group').style.display = view === 'daily' ? 'block' : 'none';
    document.getElementById('filter-month-group').style.display = view === 'monthly' ? 'block' : 'none';
  },

  async loadOffices() {
    try {
      const result = await API.getAttendance({});
      if (result.success && result.data) {
        const offices = [...new Set(result.data.map(r => r.office).filter(Boolean))].sort();
        const select = document.getElementById('filter-office');
        offices.forEach(o => {
          select.insertAdjacentHTML('beforeend', `<option value="${o}">${o}</option>`);
        });
      }
    } catch { /* ignore */ }
  },

  buildParams() {
    const view = document.getElementById('view-type').value;
    const params = {
      search: document.getElementById('filter-search').value.trim(),
      office: document.getElementById('filter-office').value,
      view
    };

    if (view === 'daily') {
      const dateVal = document.getElementById('filter-date').value;
      if (dateVal) {
        const [y, m, d] = dateVal.split('-');
        params.date = `${m}/${d}/${y}`;
      }
    } else {
      const monthVal = document.getElementById('filter-month').value;
      if (monthVal) {
        const [y, m] = monthVal.split('-');
        params.year = y;
        params.monthNum = m;
      }
    }

    return params;
  },

  async loadRecords() {
    App.showLoading(true);
    try {
      const result = await API.getAttendance(this.buildParams());
      if (result.success) {
        this.records = result.data || [];
        this.renderTable();
      } else {
        App.showToast(result.message || 'Failed to load records.', 'error');
      }
    } catch (err) {
      App.showToast(err.message, 'error');
      this.records = [];
      this.renderTable();
    } finally {
      App.showLoading(false);
    }
  },

  renderTable() {
    const tbody = document.getElementById('attendance-table-body');
    document.getElementById('record-count').textContent = `Showing ${this.records.length} records`;

    if (!this.records.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No records found.</td></tr>';
      return;
    }

    tbody.innerHTML = this.records.map(r => `
      <tr>
        <td>${r.office || ''}</td>
        <td>${r.fullName || ''}</td>
        <td>${r.date || ''}</td>
        <td>${r.amIn || '—'}</td>
        <td>${r.amOut || '—'}</td>
        <td>${r.pmIn || '—'}</td>
        <td>${r.pmOut || '—'}</td>
        <td>${r.hoursRendered ?? '—'}</td>
        <td>${App.getStatusBadge(r.status)}</td>
      </tr>
    `).join('');
  },

  exportExcel() {
    App.exportToCSV(this.records, `attendance_${App.formatDate().replace(/\//g, '-')}.csv`);
  },

  exportPDF() {
    App.exportToPDF('Attendance Records', this.records);
  },

  printRecords() {
    App.printTable('Attendance Records', this.records);
  }
};

document.addEventListener('DOMContentLoaded', () => Attendance.init());
