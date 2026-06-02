# Municipal QR Attendance Management System

**Municipality of Asuncion, Davao del Norte**

A production-ready QR-based employee attendance system using Google Sheets as the database and Google Apps Script as the backend API.

## Features

- QR code scanning for AM IN / AM OUT / PM IN / PM OUT
- One attendance row per employee per day
- Automatic hours rendered and status calculation
- Dashboard with real-time statistics and charts
- Attendance records with search and filters
- Daily, weekly, monthly, yearly reports
- Excel/CSV export, PDF print, and backup/restore
- Professional government-themed glassmorphism UI

## Tech Stack

- **Frontend:** HTML5, CSS3, Bootstrap 5, Vanilla JavaScript, HTML5 QR Code Scanner, Chart.js
- **Backend:** Google Apps Script Web App
- **Database:** Google Sheets

## Quick Start

1. Deploy `backend/Code.gs` as a Google Apps Script Web App
2. Set the Web App URL in `js/config.js`
3. Serve the frontend locally or deploy to a web host
4. Login with `admin@asuncion.gov` / `Asuncion@2026`

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete setup instructions.

## Default Login

| Email | Password | Role |
|-------|----------|------|
| admin@asuncion.gov | Asuncion@2026 | Administrator |

## License

Municipal Government of Asuncion, Davao del Norte — Internal Use
