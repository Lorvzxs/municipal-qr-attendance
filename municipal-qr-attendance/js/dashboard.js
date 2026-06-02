/**
 * Dashboard Page
 */

const Dashboard = {
  charts: {},

  async init() {
    if (!Auth.requireAuth()) return;
    App.initSidebar();
    App.loadSettings({ background: true });

    document.getElementById('dashboard-date').textContent = App.formatDate();
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    this.loadDashboardFast();
  },

  async loadDashboardFast() {
    const date = App.formatDate();
    const cacheKey = 'dashboard_' + date;
    const cached = API._getCached(cacheKey) || API._loadSessionCache(cacheKey);

    if (cached && cached.data) {
      this.renderStats(cached.data);
      this.renderCharts(cached.data);
      this.renderRecent(cached.data.recentAttendance || []);
    } else {
      this.renderStats({});
      this.renderCharts({});
      this.renderRecent([]);
      App.showLoading(true, 'Loading dashboard...');
    }

    try {
      const result = await API.getDashboard(date);
      if (result.success) {
        this.renderStats(result.data);
        this.renderCharts(result.data);
        this.renderRecent(result.data.recentAttendance || []);
      } else if (!cached) {
        App.showToast(result.message || 'Failed to load dashboard.', 'error');
      }
    } catch (err) {
      if (!cached) App.showToast(err.message, 'error');
    } finally {
      App.showLoading(false);
    }
  },

  async loadDashboard() {
    return this.loadDashboardFast();
  },

  renderStats(data) {
    document.getElementById('stat-present').textContent = data.presentToday ?? 0;
    document.getElementById('stat-late').textContent = data.lateToday ?? 0;
    document.getElementById('stat-undertime').textContent = data.undertime ?? 0;
    document.getElementById('stat-complete').textContent = data.completeAttendance ?? 0;
    document.getElementById('stat-incomplete').textContent = data.incompleteAttendance ?? 0;
    document.getElementById('stat-scans').textContent = data.totalQRScans ?? 0;
    document.getElementById('stat-avg-hours').textContent = (data.averageHoursRendered ?? 0).toFixed(2);
    document.getElementById('stat-offices').textContent = data.activeOffices ?? 0;
  },

  renderCharts(data) {
    const trend = data.attendanceTrend || [];
    const daily = data.dailyAttendance || { labels: [], data: [] };
    const office = data.officeSummary || { labels: [], data: [] };
    const monthly = data.monthlyAttendance || { labels: [], data: [] };

    const chartDefaults = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    };

    const green = '#10b981';
    const darkGreen = '#065f46';

    this.destroyCharts();

    this.charts.trend = new Chart(document.getElementById('chart-trend'), {
      type: 'line',
      data: {
        labels: trend.map(t => t.date),
        datasets: [
          { label: 'Present', data: trend.map(t => t.present), borderColor: green, backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 },
          { label: 'Late', data: trend.map(t => t.late), borderColor: '#f59e0b', tension: 0.4 },
          { label: 'Complete', data: trend.map(t => t.complete), borderColor: darkGreen, tension: 0.4 }
        ]
      },
      options: { ...chartDefaults, plugins: { legend: { display: true, position: 'bottom' } } }
    });

    this.charts.daily = new Chart(document.getElementById('chart-daily'), {
      type: 'bar',
      data: {
        labels: daily.labels.length ? daily.labels : ['No Data'],
        datasets: [{ data: daily.data.length ? daily.data : [0], backgroundColor: green }]
      },
      options: chartDefaults
    });

    this.charts.office = new Chart(document.getElementById('chart-office'), {
      type: 'doughnut',
      data: {
        labels: office.labels.length ? office.labels : ['No Data'],
        datasets: [{
          data: office.data.length ? office.data : [1],
          backgroundColor: ['#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#34d399']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    this.charts.monthly = new Chart(document.getElementById('chart-monthly'), {
      type: 'bar',
      data: {
        labels: monthly.labels.length ? monthly.labels : ['No Data'],
        datasets: [{ data: monthly.data.length ? monthly.data : [0], backgroundColor: darkGreen }]
      },
      options: chartDefaults
    });
  },

  destroyCharts() {
    Object.values(this.charts).forEach(c => c?.destroy());
    this.charts = {};
  },

  renderRecent(records) {
    const tbody = document.getElementById('recent-attendance-body');
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No attendance records yet.</td></tr>';
      return;
    }

    tbody.innerHTML = records.map(r => `
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
  }
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());
