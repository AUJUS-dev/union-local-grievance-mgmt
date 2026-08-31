# CWA Local 1118 - Grievance Management System

An enterprise interface and full-stack system for submitting, tracking, investigating, and escalating formal & informal grievances under Collective Bargaining Agreements (CBA).

Built with **Angular 19** (Signals & Angular Material 3), **Firebase Functions (v2 with TypeScript)**, **Cloud Firestore**, and **Firebase Auth with Custom Claims RBAC**.

---

## 🏛️ Project Architecture

```
union-local-grievance-mgmt/
├── client/                     # Angular 19+ Frontend (Material M3, Signals, Firebase Modular SDK)
│   ├── src/app/core/           # Auth, Grievance, CBA, PDF Services & Guards
│   ├── src/app/features/       # Dashboard, Grievances, Wizard, Detail, Admin
│   └── src/styles.scss         # Theme, tokens, status badges & Material styling
├── functions/                  # Firebase Cloud Functions v2 (TypeScript)
│   ├── src/auth.ts             # Auto member provisioning & admin role elevation
│   ├── src/audit.ts            # Immutable Firestore audit log triggers
│   ├── src/pdf.ts              # PDF grievance filing form generator (pdfkit)
│   └── src/seed.ts             # Local database & emulator seeder
├── shared/                     # Shared TypeScript domain models & types
│   ├── src/models/user.ts      # UserProfile, UserRole, CustomClaims
│   ├── src/models/grievance.ts # Grievance, Steps, Timeline, Deadlines, Activities
│   └── src/models/cba.ts       # CBAContract, CBAArticle, BargainingUnit
├── firebase.json               # Firebase Emulators (Auth: 9099, Firestore: 8080, Functions: 5001, UI: 4000)
├── firestore.rules             # Role-Based Access Control security rules
└── firestore.indexes.json      # Composite query indexes
```

---

## 🚀 Quick Start (Local Development)

### 1. Install & Build All Packages
```bash
npm run build
```

### 2. Start Firebase Emulators
In one terminal:
```bash
npm run emulators
```
This starts the local emulator suite with UI at `http://localhost:4000`.

### 3. Seed Demo Data (Local Auth & Firestore)
In a separate terminal (while emulators are running):
```bash
npm run seed
```

### 4. Start Angular Client
```bash
npm --prefix client start
```
Open `http://localhost:4200` in your browser.

---

## 👥 Demo Accounts (Local Dev)

The login screen provides **1-Click Demo Sign-in buttons**, or you can manually log in:

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Admin Officer** | `admin@unionlocal.org` | `password123` | Full access, user role elevation, CBA contract settings, analytics |
| **Chief Steward** | `steward@unionlocal.org` | `password123` | Step 1/2/3 escalation, deadline management, notes, PDF export |
| **Union Member** | `member@unionlocal.org` | `password123` | File new Step 1 grievances, track status, view own cases |

---

## ⚖️ Key Features
- **4-Step Grievance Filing Wizard**: Angular Material Stepper with interactive CBA article violation selector.
- **CBA Multi-Step Progression**: Step 1 (Informal) &rarr; Step 2 (Formal) &rarr; Step 3 (Mediation) &rarr; Step 4 (Arbitration) &rarr; Settled.
- **Contractual Countdown Timers**: Dynamic deadline indicators with urgency alerts.
- **Automatic Audit Trail**: Cloud Function trigger creates immutable activity logs on every step/status change.
- **Official PDF Generation**: Generates standard Union Grievance filing forms for employer submission.
- **Automatic Member Provisioning**: New signups automatically receive the `member` role via Cloud Function trigger.
