# Deployment Guide

## Municipal QR Attendance Management System

**Municipality of Asuncion, Davao del Norte**

This guide walks you through deploying the complete system: Google Sheets database, Google Apps Script API, and the frontend web application.

---

## Prerequisites

- Google Account (preferably `@asuncion.gov` or municipal Google Workspace)
- Modern web browser (Chrome, Edge, Firefox)
- Web server or hosting for frontend files (GitHub Pages, Netlify, local server, or municipal web host)
- Camera-enabled device for QR scanning

---

## Part 1: Google Sheets Database Setup

### Option A: Automatic (Recommended)

The backend creates the spreadsheet automatically on first API call. Skip to Part 2 if using this option.

### Option B: Manual Setup

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet named **Municipal QR Attendance Database**
3. Rename the first sheet to **Attendance**
4. Add headers in Row 1:

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| Office | Full Name | Date | AM IN | AM OUT | PM IN | PM OUT | Hours Rendered | Status | Created At | Updated At |

5. Create sheet **Users** with headers:

| Email | Password | Role | Full Name |
|-------|----------|------|-----------|
| admin@asuncion.gov | Asuncion@2026 | Administrator | System Administrator |

6. Create sheet **Settings** with headers:

| Municipality Name | System Name | Late Threshold | Required Working Hours |
|-------------------|-------------|----------------|------------------------|
| Municipality of Asuncion, Davao del Norte | Municipal QR Attendance Management System | 08:00 AM | 8 |

---

## Part 2: Google Apps Script Backend Deployment

1. Open [Google Apps Script](https://script.google.com)
2. Click **New Project**
3. Rename project to **Municipal QR Attendance API**
4. Delete default code and paste the entire contents of `backend/Code.gs`
5. Click **Save** (Ctrl+S)
6. Run function `initializeSpreadsheet` once (optional — auto-runs on first request):
   - Select `initializeSpreadsheet` from the function dropdown
   - Click **Run**
   - Authorize permissions when prompted
7. Deploy the Web App:
   - Click **Deploy** → **New deployment**
   - Click gear icon → Select type: **Web app**
   - Settings:
     - **Description:** Municipal QR Attendance API v1
     - **Execute as:** Me
     - **Who has access:** Anyone
   - Click **Deploy**
   - Copy the **Web App URL** (ends with `/exec`)

> **Important:** After any code changes, create a **New deployment** (not just Save) so the URL serves updated code.

### API Endpoints

| Method | Action | Description |
|--------|--------|-------------|
| POST | `login` | Authenticate user |
| POST | `saveAttendance` | Record QR scan |
| GET | `dashboard` | Dashboard statistics |
| GET | `attendance` | Attendance records |
| GET | `reports` | Generate reports |
| GET/POST | `settings` | Get/save settings |
| POST | `backup` | Backup database |
| POST | `restore` | Restore database |

Example GET URL:
```
https://script.google.com/macros/s/YOUR_ID/exec?action=dashboard&date=06/02/2026
```

---

## Part 3: Frontend Configuration

1. Open `js/config.js`
2. Replace the placeholder URL:

```javascript
const API_CONFIG = {
  BASE_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  TIMEOUT: 30000
};
```

Alternatively, configure the URL from **Settings** page after first login (stored in browser localStorage).

---

## Part 4: Host the Frontend

### Option A: Local Development

```powershell
cd C:\Users\MSI2\Projects\municipal-qr-attendance
npx --yes serve .
```

Open `http://localhost:3000` in your browser.

### Option B: GitHub Pages

1. Push project to GitHub repository
2. Go to **Settings** → **Pages**
3. Select branch and `/ (root)` folder
4. Access at `https://yourusername.github.io/repo-name/`

### Option C: Netlify / Vercel

Drag and drop the project folder or connect your Git repository.

### Option D: Municipal Web Server

Upload all files maintaining the folder structure to your web server document root.

---

## Part 5: Replace Assets (Optional)

Replace placeholder SVG assets with official municipal branding:

| File | Location |
|------|----------|
| Municipal seal | `assets/logos/municipal-seal.svg` (or `.png`) |
| System logo | `assets/logos/system-logo.svg` |
| Favicon | `assets/logos/favicon.svg` |
| Login background | `assets/backgrounds/login-bg.jpg` |
| Dashboard background | `assets/backgrounds/dashboard-bg.jpg` |
| Scanner background | `assets/backgrounds/scanner-bg.jpg` |
| Default avatar | `assets/profiles/default-avatar.svg` |
| Success sound | `assets/sounds/success.mp3` |

> If `success.mp3` is missing, the system plays a built-in beep sound automatically.

---

## Part 6: QR Code Format

Employees must have QR codes in this format:

```
OFFICE-FULLNAME
```

Examples:
- `HRMO-ESGUERA, LORVY JUN A.`
- `MTO-DELA CRUZ, JUAN`
- `MAYORS OFFICE-SANTOS, MARIA`

Generate QR codes using any QR generator with plain text encoding.

---

## Part 7: First Login

1. Open `index.html` in your browser
2. Login credentials (default):
   - **Email:** `admin@asuncion.gov`
   - **Password:** `Asuncion@2026`
3. Configure API URL in **Settings** if not set in `config.js`
4. Go to **QR Scanner** to test attendance recording

---

## Attendance Logic Summary

| Scan Type | Updates Column |
|-----------|----------------|
| AM IN | D |
| AM OUT | E |
| PM IN | F |
| PM OUT | G |

- **One row per employee per day** (matched by Full Name + Date)
- **Hours Rendered** = (AM OUT − AM IN) + (PM OUT − PM IN)
- **Status:**
  - `INCOMPLETE` — missing any time entry
  - `UNDERTIME` — hours < required (default 8)
  - `LATE` — AM IN after threshold (default 08:00 AM)
  - `COMPLETE` — all entries filled, hours met, on time

---

## Security Recommendations

1. Change default admin password in the **Users** sheet immediately
2. Use Google Workspace accounts for production authentication
3. Consider hashing passwords (current version uses plain text for simplicity)
4. Restrict Web App access to municipal IP ranges if possible
5. Regularly backup using **Settings → Backup Database**

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Please configure API URL" | Set URL in `js/config.js` or Settings page |
| Login fails | Verify Users sheet credentials and Web App deployment |
| CORS / fetch errors | Ensure Web App is deployed with "Anyone" access |
| Camera not working | Use HTTPS; grant camera permission; try manual QR entry |
| Duplicate rows | System prevents duplicates by Full Name + Date match |
| Dashboard shows zeros | Normal when database is empty — scan QR codes to populate |

---

## Project Structure

```
municipal-qr-attendance/
├── index.html              # Login page
├── pages/
│   ├── dashboard.html
│   ├── scanner.html
│   ├── attendance.html
│   ├── reports.html
│   └── settings.html
├── css/style.css
├── js/
│   ├── config.js           # API URL configuration
│   ├── api.js
│   ├── auth.js
│   ├── app.js
│   ├── dashboard.js
│   ├── scanner.js
│   ├── attendance.js
│   ├── reports.js
│   └── settings.js
├── backend/Code.gs         # Google Apps Script backend
├── assets/
└── DEPLOYMENT.md
```

---

## Support

For technical support, contact your Municipal IT Office or System Administrator.
