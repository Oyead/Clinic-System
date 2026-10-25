# Clinic System

A full-stack clinic appointment management platform with role-based access control, availability scheduling, staff invites, audit logging, and online payments via Paymob.

## Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [Authentication & Roles](#authentication--roles)
- [Paymob Integration](#paymob-integration)
- [Email Notifications](#email-notifications)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security Notes](#security-notes)

---

## Overview

Clinic System lets patients book appointments with doctors at clinics. Staff (doctors, receptionists, admins) manage appointments and availability. Clinic owners manage staff, set doctor consultation fees, and view billing reports.

Key features:

- Multi-role auth (super admin, admin, doctor, receptionist, clinic owner, patient)
- Patient appointment booking with optional online payment
- Doctor/receptionist/admin appointment approval/rejection
- Clinic availability slots and overlap prevention
- Staff invite/suspend/offboard lifecycle for clinic owners
- Paymob Unified Checkout for online payments (EGP)
- HMAC-signed Paymob webhooks
- Automated payment expiry sweep
- SendPulse email notifications (payment required / confirmed / expired)
- Audit logging for admin actions

---

## Architecture

The project is a monorepo with two deployable services:

```
clinic-system/
├── clinic-backend/          # Node.js + Express API (serves frontend in production)
│   ├── server.js            # Entry point: mounts routes, starts payment sweep, bootstraps super admin
│   ├── src/
│   │   ├── config/          # PostgreSQL connection pool (pg)
│   │   ├── controllers/     # Route handlers (auth, appointment, availability, admin, owner, payment)
│   │   ├── middleware/      # Auth (JWT) + owner scope guards
│   │   ├── models/          # Data access layer (SQL queries)
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Business logic (paymentService, etc.)
│   │   └── utils/           # paymobClient, email templates, tokens, roles, bootstrap, mailer
│   ├── scripts/
│   │   ├── migrations/      # Numbered SQL migration files (001..012)
│   │   ├── runMigrations.js # Migration runner
│   │   ├── seedAdmin.js     # Super admin seeding
│   │   ├── verify-roles.sh  # Role/endpoint verification script
│   │   └── wipeDatabase.js  # Dev database reset
│   ├── test/                # Node:test paymob client tests
│   └── package.json
├── frontend/                # React 19 + Vite SPA
│   ├── src/
│   │   ├── api/             # Fetch client for /api/v1 endpoints
│   │   ├── components/      # UI panels (AdminPanel, OwnerPanel, PatientPanel, StaffPanel, PaymentDialog, ...)
│   │   ├── context/         # Auth context
│   │   ├── App.jsx, router.js, index.css
│   │   └── ...
│   ├── dist/                # Production build (served by backend)
│   └── package.json
├── .env                     # Root environment variables (gitignored)
├── vercel.json              # Vercel deployment config (backend + frontend services)
└── README.md
```

Backend communicates with PostgreSQL via `pg`. The frontend is a Vite React app that calls the backend API. In production, the Express backend serves the built frontend from `frontend/dist/` with an SPA fallback.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend runtime | Node.js (CommonJS) |
| Backend framework | Express 5 |
| Database | PostgreSQL (Neon serverless / any PG) |
| DB client | `pg` (node-postgres) |
| Auth | JSON Web Tokens (jsonwebtoken) |
| Payments | Paymob Accept API (Unified Checkout) |
| Email | SendPulse SMTP API |
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS 4 |
| Lint | oxlint |
| Deployment | Vercel |

---

## Directory Structure

### Backend (`clinic-backend/`)

| Path | Purpose |
|------|---------|
| `server.js` | App entry point; mounts all route modules; starts 5-minute payment expiry sweep; bootstraps super admin |
| `src/config/db.js` | PostgreSQL connection pool + `withTransaction` helper |
| `src/controllers/authController.js` | Signup, login, refresh, signout, profile update, clinic signup, invite acceptance |
| `src/controllers/appointmentController.js` | Booking, listing, approve/reject/cancel, booking options |
| `src/controllers/availabilityController.js` | Availability slot CRUD |
| `src/controllers/adminController.js` | Admin dashboard, users, clinics, audit logs |
| `src/controllers/ownerController.js` | Clinic owner: staff management, doctor fees, queue, reports |
| `src/controllers/paymentController.js` | Payment config, appointment payment status, intention creation, Paymob webhook |
| `src/middleware/auth.js` | `requireAuth`, `requireAdmin`, `requireRole` JWT guards |
| `src/middleware/ownerScope.js` | Clinic-scoped access for owner routes |
| `src/models/*` | SQL data-access layer per domain |
| `src/services/paymentService.js` | Payment intention flow, webhook handling, expiry sweep |
| `src/utils/paymobClient.js` | Paymob intention creation, checkout URL, HMAC build/verify |
| `src/utils/appointmentEmail.js` | SendPulse email templates |
| `src/utils/sendpulseMailer.js` | SendPulse HTTP mailer |
| `src/utils/bootstrapAdmin.js` | Super admin seeding on startup |
| `src/utils/roles.js` | Role normalization + loginable statuses |
| `src/utils/tokens.js` | JWT access/refresh token helpers |
| `src/utils/password.js` | Password hashing/comparison |
| `src/utils/invites.js` | Invite token generation/verification |
| `scripts/migrations/*.sql` | Versioned database migrations |
| `test/paymobClient.test.js` | Paymob client unit tests (node:test) |

### Frontend (`frontend/`)

| Path | Purpose |
|------|---------|
| `src/App.jsx` | Root app with router + auth context |
| `src/router.js` | Route definitions by role |
| `src/api/client.js` | Fetch-based API client |
| `src/context/AuthContext.jsx` | Auth state + token management |
| `src/components/AuthForms.jsx` | Login/signup forms |
| `src/components/AdminPanel.jsx` | Admin dashboard |
| `src/components/OwnerPanel.jsx` | Clinic owner dashboard |
| `src/components/StaffPanel.jsx` | Staff (doctor/receptionist) dashboard |
| `src/components/PatientPanel.jsx` | Patient dashboard |
| `src/components/PaymentDialog.jsx` | Paymob checkout dialog |
| `src/components/ActiveCalendar.jsx` | Calendar view |
| `src/components/Appointments.jsx` | Appointment list |
| `src/components/AvailabilityManager.jsx` | Slot management |
| `src/components/Hero.jsx`, `Notice.jsx`, `ui.js`, etc. | Shared UI |
| `vite.config.js` | Vite config (proxy to backend in dev) |

---

## Prerequisites

- Node.js 18+ (npm)
- PostgreSQL database (local or hosted, e.g. Neon)
- A Paymob test account (for payments)
- A SendPulse account (for email notifications, optional)

---

## Environment Configuration

Copy `.env.example` (or create `.env` at the project root) and fill in the values:

```bash
# Server
PORT=5000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=clinic_app_user
DB_PASSWORD=changeme
DB_NAME=clinic_db
DATABASE_URL=postgresql://clinic_app_user:changeme@localhost:5432/clinic_db?sslmode=require

# Auth
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=24h
ACCESS_TOKEN_SECRET=<strong-random-secret>
ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=<strong-random-secret>
REFRESH_EXPIRES_IN=7d
COOKIE_SAMESITE=Lax

# Super admin bootstrap (only when zero admins exist)
SUPER_ADMIN_EMAIL=admin@clinic.local
SUPER_ADMIN_PASSWORD=<strong-password>

# Email (SendPulse)
MAIL_API=<sendpulse-api-key>
MAIL_ENABLED=true
MAIL_FROM_EMAIL=devtest@sendpulseemail.com
MAIL_SENDPULSE_ENDPOINT=https://api.sendpulse.com/smtp/emails

# App
APP_TIMEZONE=Africa/Cairo
APP_PUBLIC_URL=http://localhost:5173

# Paymob
PAYMOB_BASE_URL=https://accept.paymob.com
PAYMOB_CURRENCY=EGP
PAYMENT_EXPIRY_HOURS=24
Paymob_Secret_Key=egy_sk_test_...
Paymob_Public_Key=egy_pk_test_...
Paymob_HMAC=<hmac-secret>
Paymob_Integration_ID=<integration-id>
PAYMOB_WEBHOOK_URL=https://your-domain.com/api/v1/payments/paymob/webhook
```

> `.env` is gitignored. Do not commit real secrets.

Paymob env variable precedence in `paymobClient.js`:
- `Paymob_Secret_Key` falls back to `PAYMOB_SECRET_KEY`
- `Paymob_Public_Key` falls back to `PAYMOB_PUBLIC_KEY`
- `Paymob_Integration_ID` falls back to `PAYMOB_INTEGRATION_ID`
- `Paymob_HMAC` falls back to `PAYMOB_HMAC`

---

## Database Setup

### 1. Create the database

Create a PostgreSQL database and user, then set `DATABASE_URL` in `.env`.

### 2. Run migrations

From `clinic-backend/`:

```bash
npm run migrate
```

This runs the numbered SQL migrations in `scripts/migrations/`:

| Migration | Description |
|-----------|-------------|
| 001 | `awaiting_payment` appointment status |
| 002 | Receptionists table |
| 003 | Admin audit logs |
| 004 | Audit appointment status |
| 005 | Clinic owners |
| 006 | Query indexes |
| 007 | Scheduling constraints |
| 008 | Role lifecycle |
| 009 | Availability slots |
| 010 | No slot overlap |
| 011 | User sessions |
| 012 | Paymob: `payment_transactions` table, `awaiting_payment` status, consultation fee |

### 3. Seed the super admin

```bash
npm run seed:admin
```

This is a no-op if any admin already exists. Uses `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from `.env`.

---

## Backend Setup

From the project root or `clinic-backend/`:

```bash
cd clinic-backend
npm install
```

### Start (development)

```bash
npm start        # node server.js
# or
npx nodemon      # auto-restart
```

The backend listens on `PORT` (default 5000). On startup it:
1. Connects to PostgreSQL
2. Runs the overdue-payment sweep immediately, then every 5 minutes
3. Bootstraps the super admin if none exists
4. Serves the frontend build from `frontend/dist/` (if present)

### Health check

```bash
curl http://localhost:5000/api/health
# {"status":"API operational"}
```

---

## Frontend Setup

From `frontend/`:

```bash
cd frontend
npm install
```

### Start (development)

```bash
npm run dev      # http://localhost:5173, /api proxied to http://localhost:5001
```

Run the backend separately from `clinic-backend/` (`npm start`).

### Build (production)

```bash
npm run build    # emits frontend/dist/
```

The Express backend serves `frontend/dist/` with an SPA fallback, so no extra deploy step is needed beyond building.

---

## Running the Application

Option A — run both locally:

```bash
# Terminal 1: backend
cd clinic-backend && npm install && npm start

# Terminal 2: frontend
cd frontend && npm install && npm run dev
```

Backend: `http://localhost:5000`
Frontend: `http://localhost:5173`

Option B — production-like (backend serves frontend):

```bash
cd frontend && npm run build
cd clinic-backend && npm start
# Visit http://localhost:5000
```

---

## API Reference

Base path: `/api/v1`

### Auth (`/api/v1/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/signup` | Patient signup | No |
| PATCH | `/profile` | Update user profile | Yes |
| POST | `/signup-clinic` | Clinic + owner signup | No |
| POST | `/accept-invite` | Accept staff invite and set password | No |
| POST | `/login` | Login (returns access + refresh tokens) | No |
| POST | `/refresh` | Refresh access token | No |
| POST | `/signout` | Sign out / revoke refresh token | Yes |

### Appointments (`/api/v1/appointments`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/` | Book appointment | patient |
| GET | `/mine` | List my appointments | patient |
| GET | `/booking-options` | Clinics/doctors for booking | Public |
| GET | `/` | List appointments | doctor, receptionist, admin |
| PATCH | `/:id/approve` | Approve appointment | doctor, receptionist, admin |
| PATCH | `/:id/reject` | Reject appointment | doctor, receptionist, admin |
| PATCH | `/:id/cancel` | Cancel appointment | All (owner-scoped) |

Paid appointments transition to `awaiting_payment` and require online payment before becoming `scheduled`.

### Availability (`/api/v1/availability`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List availability slots | patient, doctor, receptionist, clinic_owner, admin |
| POST | `/` | Create availability slot | doctor, receptionist, clinic_owner, admin |
| DELETE | `/:id` | Remove availability slot | doctor, receptionist, clinic_owner, admin |

### Admin (`/api/v1/admin`)

Requires authentication + admin role.

| Method | Endpoint | Description |
|--------|----------|-------------|
| (various) | Users, clinics, audit logs, dashboard stats | Admin operations |

### Owner (`/api/v1/owner`)

Requires authentication + clinic_owner role + clinic scope.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clinics` | List my clinics |
| GET | `/clinics/:clinicId/staff` | List clinic staff |
| POST | `/clinics/:clinicId/staff/invite` | Invite staff |
| GET | `/clinics/:clinicId/invites` | List invites |
| POST | `/clinics/:clinicId/invites/:inviteId/resend` | Resend invite |
| DELETE | `/clinics/:clinicId/invites/:inviteId` | Revoke invite |
| POST | `/clinics/:clinicId/staff/:userId/offboard` | Offboard staff |
| POST | `/clinics/:clinicId/staff/:userId/suspend` | Suspend staff |
| DELETE | `/clinics/:clinicId/staff/:userId` | Remove staff |
| PATCH | `/clinics/:clinicId/doctors/:doctorId/fee` | Set doctor consultation fee |
| GET | `/clinics/:clinicId/appointments` | List clinic queue |
| PATCH | `/appointments/:apptId/approve\|reject` | Decide appointment |
| GET | `/clinics/:clinicId/reports/appointments` | Appointment reports |
| GET | `/clinics/:clinicId/reports/billing` | Billing reports |

### Payments (`/api/v1/payments`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/config` | Paymob public config (enabled, currency, publicKey) | Yes |
| GET | `/appointments/:id` | Appointment payment status + checkout URL | patient |
| POST | `/appointments/:id/intention` | Create Paymob payment intention | patient |
| POST | `/paymob/webhook` | Paymob webhook (HMAC verified) | No |

---

## Authentication & Roles

### Roles

- `super_admin` — platform-level admin
- `admin` — admin user
- `doctor` — clinic doctor
- `receptionist` — clinic receptionist
- `clinic_owner` — clinic owner
- `patient` — appointment patient

### Auth flow

1. Client logs in via `POST /api/v1/auth/login`
2. Server issues an access token (15 min) and refresh token (7 days)
3. Client sends `Authorization: Bearer <access_token>` on protected requests
4. When the access token expires, client calls `POST /api/v1/auth/refresh`
5. `signout` revokes the refresh token

### Middleware

- `requireAuth` — valid JWT + active, loginable user status
- `requireAdmin` — role must be `admin`
- `requireRole(...)` — role must be one of the listed roles
- `requireClinicScope` — owner must be scoped to the requested clinic

User statuses: `active`, `invited`, `suspended`, `offboarded`, `pending_verification`. Only `active` users (and `pending_verification` in some flows) can log in.

---

## Paymob Integration

Clinic System integrates with **Paymob Accept API** using **Unified Checkout**.

### Flow

1. Patient books an appointment with a fee > 0 → appointment status becomes `awaiting_payment`
2. Patient calls `POST /api/v1/payments/appointments/:id/intention`
3. Backend calls Paymob `POST /v1/intention/` to create a payment intention
4. Backend returns a `checkout_url` (Paymob Unified Checkout)
5. Patient completes payment on Paymob's hosted page
6. Paymob POSTs a webhook to `POST /api/v1/payments/paymob/webhook`
7. Backend verifies the HMAC-SHA512 signature, then:
   - On success: marks transaction `paid`, sets appointment `scheduled`, creates a paid bill, sends confirmation email
   - On failure: marks transaction `failed`

### Key files

- `clinic-backend/src/utils/paymobClient.js` — intention creation, checkout URL, HMAC build/verify
- `clinic-backend/src/services/paymentService.js` — payment flow orchestration + webhook handler
- `clinic-backend/src/controllers/paymentController.js` — HTTP layer for payments
- `clinic-backend/src/models/paymentModel.js` — `payment_transactions` data access
- `clinic-backend/scripts/migrations/012_paymob.sql` — schema for payments

### Paymob env vars

| Variable | Description |
|----------|-------------|
| `Paymob_Secret_Key` | Paymob secret API key |
| `Paymob_Public_Key` | Paymob public key (frontend checkout) |
| `Paymob_Integration_ID` | Paymob integration ID |
| `Paymob_HMAC` | Webhook HMAC secret |
| `PAYMOB_BASE_URL` | `https://accept.paymob.com` |
| `PAYMOB_CURRENCY` | `EGP` |
| `PAYMENT_EXPIRY_HOURS` | Payment window (default 24) |
| `APP_PUBLIC_URL` | Frontend URL (for redirection) |
| `PAYMOB_WEBHOOK_URL` | Public webhook URL (must be reachable by Paymob) |

> ⚠️ The `.env` currently uses a trycloudflare tunnel URL for `PAYMOB_WEBHOOK_URL`. Replace it with a stable public URL before production so Paymob can deliver webhooks.

### Tests

Run paymob client unit tests:

```bash
cd clinic-backend
npm test
```

Tests cover HMAC payload building, signature verification (valid/tampered/wrong-secret), checkout URL encoding, and intention request payload.

---

## Email Notifications

Emails are sent via **SendPulse SMTP API**.

Configure in `.env`:

- `MAIL_API` — SendPulse API key
- `MAIL_ENABLED` — `true` to enable
- `MAIL_FROM_EMAIL` — sender address
- `MAIL_SENDPULSE_ENDPOINT` — SendPulse SMTP endpoint

Email templates in `clinic-backend/src/utils/appointmentEmail.js`:

- Payment required (with checkout URL)
- Payment confirmed
- Payment expired

---

## Testing

Paymob client tests (Node built-in `node:test`):

```bash
cd clinic-backend
npm test
```

Expected output: 6 tests, 0 failures.

---

## Deployment

### Vercel

`vercel.json` configures two services:

```json
{
  "services": {
    "clinic-backend": { "root": "clinic-backend", "framework": "express" },
    "frontend": { "root": "frontend", "framework": "vite" }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "clinic-backend" } },
    { "source": "/(.*)", "destination": { "service": "frontend" } }
  ]
}
```

- `/api/*` routes to the Express backend
- Everything else routes to the Vite frontend

Set all `.env` variables in the Vercel project settings before deploying.

### Docker / other

No Dockerfile is present. To containerize, build the frontend (`npm run build` in `frontend/`), then run `clinic-backend/server.js` with the production `.env`.

---

## Security Notes

- `.env` contains secrets and is gitignored — never commit it
- Rotate `JWT_SECRET`, `JWT_EXPIRES_IN`, and Paymob keys before production
- `PAYMOB_WEBHOOK_URL` must be a stable public HTTPS URL (not a tunnel) in production
- Webhook HMAC is verified with `crypto.timingSafeEqual` to prevent timing attacks
- Super admin bootstrap only runs when zero admins exist; change `SUPER_ADMIN_PASSWORD` immediately after first deploy
- Passwords are hashed before storage
- Refresh tokens are revoked on signout

---

## License

ISC