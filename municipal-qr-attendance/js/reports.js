/**
 * Reports Page
 */

const Reports = {
  records: [],
  summary: null,

  async init() {
    if (!Auth.requireAuth()) return;
    App.initSidebar();
    App.loadSettings({ background: true });

    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    const today = new Date();
    document.getElementById('report-date').value = today.toISOString().split('T')[0];
    document.getElementById('report-month').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('report-year').value = today.getFullYear();

    document.getElementById('report-type').addEventListener('change', () => this.toggleReportFilters());
    document.getElementById('btn-generate').addEventListener('click', () => this.generateReport());
    document.getElementById('btn-export-excel').addEventListener('click', () => this.exportExcel());
    document.getElementById('btn-export-pdf').addEventListener('click', () => this.exportPDF());
    document.getElementById('btn-print').addEventListener('click', () => this.printReport());

    await this.loadOffices();
    this.toggleReportFilters();
  },

  toggleReportFilters() {
    const type = document.getElementById('report-type').value;
    document.getElementById('report-date-group').style.display =
      ['daily', 'weekly', 'late', 'undertime', 'office'].includes(type) ? 'block' : 'none';
    document.getElementById('report-month-group').style.display = type === 'monthly' ? 'block' : 'none';
    document.getElementById('report-year-group').style.display = type === 'yearly' ? 'block' : 'none';
    document.getElementById('report-office-group').style.display = type === 'office' ? 'block' : 'none';
  },

  async loadOffices() {
    try {
      const result = await API.getReports({ reportType: 'daily' });
      const offices = result.offices || [];
      const select = document.getElementById('report-office');
      offices.forEach(o => {
        select.insertAdjacentHTML('beforeend', `<option value="${o}">${o}</option>`);
      });
    } catch { /* ignore */ }
  },

  buildParams() {
    const type = document.getElementById('report-type').value;
    const params = { reportType: type };

    if (['daily', 'weekly', 'late', 'undertime', 'office'].includes(type)) {
      const dateVal = document.getElementById('report-date').value;
      if (dateVal) {
        const [y, m, d] = dateVal.split('-');
        params.date = `${m}/${d}/${y}`;
      }
    }

    if (type === 'monthly') {
      const monthVal = document.getElementById('report-month').value;
      if (monthVal) {
        const [y, m] = monthVal.split('-');
        params.year = y;
        params.month = m;
      }
    }

    if (type === 'yearly') {
      params.year = document.getElementById('report-year').value;
    }

    if (type === 'office') {
      params.office = document.getElementById('report-office').value;
    }

    return params;
  },

  async generateReport() {
    App.showLoading(true, 'Generating report...');
    try {
      const params = this.buildParams();
      const result = await API.getReports(params);
      if (result.success) {
        this.records = result.data || [];
        this.summary = result.summary || null;
        this.renderReport(params.reportType);
      } else {
        App.showToast(result.message || 'Failed to generate report.', 'error');
      }
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      App.showLoading(false);
    }
  },

  renderReport(type) {
    const titles = {
      daily: 'Daily Report',
      weekly: 'Weekly Report',
      monthly: 'Monthly Report',
      yearly: 'Yearly Report',
      office: 'Office Attendance Report',
      late: 'Late Employees Report',
      undertime: 'Undertime Report'
    };

    document.getElementById('report-title').textContent = titles[type] || 'Report Results';

    if (this.summary) {
      document.getElementById('report-summary').style.display = 'flex';
      document.getElementById('sum-total').textContent = this.summary.totalRecords ?? 0;
      document.getElementById('sum-complete').textContent = this.summary.complete ?? 0;
      document.getElementById('sum-late').textContent = this.summary.late ?? 0;
      document.getElementById('sum-undertime').textContent = this.summary.undertime ?? 0;
    }

    const tbody = document.getElementById('report-table-body');
    if (!this.records.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No records found for this report.</td></tr>';
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
    if (!this.records.length) {
      App.showToast('Generate a report first.', 'warning');
      return;
    }
    const title = document.getElementById('report-title').textContent.replace(/\s+/g, '_').toLowerCase();
    App.exportToCSV(this.records, `${title}_${App.formatDate().replace(/\//g, '-')}.csv`);
  },

  exportPDF() {
    if (!this.records.length) {
      App.showToast('Generate a report first.', 'warning');
      return;
    }
    App.exportToPDF(document.getElementById('report-title').textContent, this.records, this.summary);
  },

  printReport() {
    if (!this.records.length) {
      App.showToast('Generate a report first.', 'warning');
      return;
    }
    App.printTable(document.getElementById('report-title').textContent, this.records, this.summary);
  }
};

document.addEventListener('DOMContentLoaded', () => Reports.init());
