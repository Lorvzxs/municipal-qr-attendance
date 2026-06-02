/**
 * Settings Page
 */

const Settings = {
  async init() {
    if (!Auth.requireAuth()) return;
    App.initSidebar();

    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    const savedUrl = API.getBaseUrl();
    if (savedUrl && !savedUrl.includes('YOUR_GOOGLE')) {
      document.getElementById('api-url').value = savedUrl;
    }

    document.getElementById('settings-form').addEventListener('submit', e => this.saveSettings(e));
    document.getElementById('btn-save-api').addEventListener('click', () => this.saveApiUrl());
    document.getElementById('btn-backup').addEventListener('click', () => this.createBackup());
    document.getElementById('btn-restore').addEventListener('click', () => this.restoreBackup());

    await this.loadSettings();
  },

  async loadSettings() {
    App.showLoading(true);
    try {
      const result = await API.getSettings();
      if (result.success && result.data) {
        document.getElementById('municipality-name').value = result.data.municipalityName;
        document.getElementById('system-name').value = result.data.systemName;
        document.getElementById('late-threshold').value = result.data.lateThreshold;
        document.getElementById('required-hours').value = result.data.requiredWorkingHours;
      }
    } catch (err) {
      App.showToast('Could not load settings: ' + err.message, 'warning');
    } finally {
      App.showLoading(false);
    }
  },

  async saveSettings(e) {
    e.preventDefault();
    App.showLoading(true);

    const settings = {
      municipalityName: document.getElementById('municipality-name').value.trim(),
      systemName: document.getElementById('system-name').value.trim(),
      lateThreshold: document.getElementById('late-threshold').value.trim(),
      requiredWorkingHours: parseFloat(document.getElementById('required-hours').value)
    };

    try {
      const result = await API.saveSettings(settings);
      if (result.success) {
        APP_CONFIG.municipalityName = settings.municipalityName;
        APP_CONFIG.systemName = settings.systemName;
        App.showToast('Settings saved successfully!', 'success');
      } else {
        App.showToast(result.message || 'Failed to save settings.', 'error');
      }
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      App.showLoading(false);
    }
  },

  saveApiUrl() {
    const url = document.getElementById('api-url').value.trim();
    if (!url) {
      App.showToast('Please enter a valid API URL.', 'warning');
      return;
    }
    API.setBaseUrl(url);
    API_CONFIG.BASE_URL = url;
    App.showToast('API URL saved successfully!', 'success');
  },

  async createBackup() {
    App.showLoading(true, 'Creating backup...');
    try {
      const result = await API.backupDatabase();
      if (result.success && result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `mqams_backup_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        App.showToast('Backup downloaded successfully!', 'success');
      } else {
        App.showToast(result.message || 'Backup failed.', 'error');
      }
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      App.showLoading(false);
    }
  },

  async restoreBackup() {
    const fileInput = document.getElementById('restore-file');
    const file = fileInput.files[0];
    if (!file) {
      App.showToast('Please select a backup file.', 'warning');
      return;
    }

    if (!confirm('This will overwrite attendance data. Are you sure you want to restore?')) return;

    App.showLoading(true, 'Restoring backup...');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await API.restoreDatabase(data);
      if (result.success) {
        App.showToast('Database restored successfully!', 'success');
        fileInput.value = '';
      } else {
        App.showToast(result.message || 'Restore failed.', 'error');
      }
    } catch (err) {
      App.showToast('Invalid backup file: ' + err.message, 'error');
    } finally {
      App.showLoading(false);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => Settings.init());
