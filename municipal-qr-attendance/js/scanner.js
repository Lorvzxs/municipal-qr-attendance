/**
 * QR Scanner Page — optimized for fast scanning
 */

const Scanner = {
  html5QrCode: null,
  isScanning: false,
  processing: false,
  cameras: [],
  currentCameraIndex: 0,
  lastScanTime: 0,
  lastScannedCode: '',
  scanCooldown: 900,
  audioCtx: null,

  async init() {
    if (!Auth.requireAuth()) return;
    App.initSidebar();
    App.loadSettings({ background: true });

    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    document.getElementById('start-scanner').addEventListener('click', () => this.startScanner());
    document.getElementById('stop-scanner').addEventListener('click', () => this.stopScanner());
    document.getElementById('switch-camera').addEventListener('click', () => this.switchCamera());
    document.getElementById('manual-submit').addEventListener('click', () => this.handleManualEntry());
    document.getElementById('manual-qr').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleManualEntry();
    });

    this.preloadAudio();
    this.loadCameras().then(() => this.startScanner());
  },

  preloadAudio() {
    const audio = document.getElementById('success-sound');
    if (audio) audio.load();
  },

  pickBestCameraIndex() {
    if (!this.cameras.length) return 0;
    const back = this.cameras.findIndex((c) =>
      /back|rear|environment/i.test(c.label || '')
    );
    return back >= 0 ? back : 0;
  },

  async loadCameras() {
    try {
      this.cameras = await Html5Qrcode.getCameras();
      this.currentCameraIndex = this.pickBestCameraIndex();
    } catch {
      this.cameras = [];
    }
  },

  getScanConfig() {
    return {
      fps: 20,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const edge = Math.min(viewfinderWidth, viewfinderHeight);
        const size = Math.floor(edge * 0.72);
        return { width: size, height: size };
      },
      aspectRatio: 1,
      disableFlip: true,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    };
  },

  async startScanner() {
    if (this.isScanning) return;

    if (!this.cameras.length) await this.loadCameras();
    if (!this.cameras.length) {
      App.showToast('No camera found. Use manual QR entry.', 'warning');
      return;
    }

    const readerEl = document.getElementById('qr-reader');
    if (!this.html5QrCode) {
      this.html5QrCode = new Html5Qrcode('qr-reader', { verbose: false });
    }

    const cameraId = this.cameras[this.currentCameraIndex].id;

    try {
      await this.html5QrCode.start(
        cameraId,
        this.getScanConfig(),
        (decodedText) => this.onScanSuccess(decodedText),
        () => {}
      );

      this.isScanning = true;
      readerEl.classList.add('scanner-active');
      document.getElementById('start-scanner').disabled = true;
      document.getElementById('stop-scanner').disabled = false;
      document.getElementById('switch-camera').disabled = this.cameras.length < 2;
    } catch (err) {
      App.showToast('Camera error: ' + err.message, 'error');
    }
  },

  async stopScanner() {
    if (!this.html5QrCode || !this.isScanning) return;

    try {
      await this.html5QrCode.stop();
      this.html5QrCode.clear();
    } catch { /* ignore */ }

    this.isScanning = false;
    document.getElementById('qr-reader')?.classList.remove('scanner-active');
    document.getElementById('start-scanner').disabled = false;
    document.getElementById('stop-scanner').disabled = true;
    document.getElementById('switch-camera').disabled = true;
  },

  async switchCamera() {
    if (this.cameras.length < 2) return;
    this.currentCameraIndex = (this.currentCameraIndex + 1) % this.cameras.length;
    await this.stopScanner();
    await this.startScanner();
  },

  async onScanSuccess(qrData) {
    if (this.processing) return;

    const code = String(qrData || '').trim();
    if (!code) return;

    const now = Date.now();
    if (code === this.lastScannedCode && now - this.lastScanTime < this.scanCooldown) return;

    this.lastScanTime = now;
    this.lastScannedCode = code;
    await this.processScan(code);
  },

  async handleManualEntry() {
    const qrData = document.getElementById('manual-qr').value.trim();
    if (!qrData) {
      App.showToast('Please enter QR code data.', 'warning');
      return;
    }
    await this.processScan(qrData);
    document.getElementById('manual-qr').value = '';
  },

  setScanBusy(busy) {
    this.processing = busy;
    const btn = document.getElementById('manual-submit');
    const reader = document.getElementById('qr-reader');
    if (btn) btn.disabled = busy;
    if (reader) reader.classList.toggle('scanner-processing', busy);
  },

  async processScan(qrData) {
    if (this.processing) return;

    const scanType = document.getElementById('scan-type').value;
    this.setScanBusy(true);
    App.playSuccessSound();

    try {
      const result = await API.saveAttendance(qrData, scanType);
      if (result.success) {
        this.showResult(result.data, scanType);
        App.showToast('Attendance recorded!', 'success');
        API.clearCache('dashboard_' + App.formatDate());
      } else {
        App.showToast(result.message || 'Failed to record attendance.', 'error');
        this.lastScannedCode = '';
      }
    } catch (err) {
      App.showToast(err.message, 'error');
      this.lastScannedCode = '';
    } finally {
      this.setScanBusy(false);
    }
  },

  showResult(data, scanType) {
    const card = document.getElementById('scan-result');
    document.getElementById('result-name').textContent = data.fullName || '—';
    document.getElementById('result-office').textContent = data.office || '—';
    document.getElementById('result-date').textContent = data.date || App.formatDate();
    document.getElementById('result-time').textContent = App.formatTime();
    document.getElementById('result-type').textContent = scanType;
    document.getElementById('result-status').innerHTML = App.getStatusBadge(data.status);
    card.classList.add('show');
  }
};

document.addEventListener('DOMContentLoaded', () => Scanner.init());
