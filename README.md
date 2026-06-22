<div align="center">

# 🇮🇳 Apka Sikayat — आपकी शिकायत

### *AI-Powered Smart Governance & Citizen Grievance Management Platform*

[![Live Frontend](https://img.shields.io/badge/Live%20App-Vercel-black?style=for-the-badge&logo=vercel)](https://apka-sikayat.vercel.app)
[![Backend](https://img.shields.io/badge/Backend%20API-Render-46E3B7?style=for-the-badge&logo=render)](https://apka-sikayat.onrender.com/health)
[![Firebase](https://img.shields.io/badge/Database-Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-000000?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev)

> A full-stack, enterprise-grade smart governance platform that digitizes the entire lifecycle of citizen complaints — from AI-powered submission validation to real-time tracking, WhatsApp/SMS notifications, and Chief Minister executive intelligence dashboards powered by RAG (Retrieval-Augmented Generation) and Pinecone vector stores.

</div>

---

## 📋 Table of Contents

- [🌟 Project Overview](#-project-overview)
- [🏗️ Architecture Overview](#️-architecture-overview)
- [✨ Feature Breakdown (Basic → Advanced)](#-feature-breakdown-basic--advanced)
  - [1. Authentication System](#1-authentication-system)
  - [2. Citizen Portal](#2-citizen-portal)
  - [3. Officer Dashboard](#3-officer-dashboard)
  - [4. Department Dashboard](#4-department-dashboard)
  - [5. Chief Minister (CM) Command Center](#5-chief-minister-cm-command-center)
  - [6. State Admin Dashboard](#6-state-admin-dashboard)
  - [7. Super Admin Panel](#7-super-admin-panel)
  - [8. AI & ML Engine](#8-ai--ml-engine)
  - [9. Notification System](#9-notification-system)
  - [10. Real-Time Infrastructure](#10-real-time-infrastructure)
  - [11. PDF Generation Engine](#11-pdf-generation-engine)
  - [12. Public Complaint Tracking](#12-public-complaint-tracking)
  - [13. Security & Compliance](#13-security--compliance)
- [📁 Project Structure](#-project-structure)
- [🛠️ Tech Stack](#️-tech-stack)
- [🚀 Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Local Development Setup](#local-development-setup)
- [🌐 API Reference](#-api-reference)
- [🗃️ Firestore Data Schema](#️-firestore-data-schema)
- [👥 User Roles & Permissions](#-user-roles--permissions)
- [📊 Complaint Lifecycle](#-complaint-lifecycle)
- [🤖 AI Copilot Architecture](#-ai-copilot-architecture)
- [📱 Notification Channels](#-notification-channels)
- [🚢 Deployment Guide](#-deployment-guide)
- [🔐 Security Features](#-security-features)
- [📈 Roadmap](#-roadmap)
- [🤝 Contributing](#-contributing)

---

## 🌟 Project Overview

**Apka Sikayat** (Hindi: "Your Complaint") is a next-generation AI-powered digital governance platform designed for the Government of Delhi. It transforms how citizens file grievances and how the state administration tracks, manages, and resolves them — all powered by real-time technology and artificial intelligence.

### 🎯 Key Problems Solved

| Problem | Solution |
|---------|----------|
| Grievance submission is paper-based and slow | AI-validated digital submission with photo evidence |
| Citizens don't know complaint status | Real-time tracking via unique IDs + WhatsApp/SMS updates |
| Officers overwhelmed with unstructured data | Smart dashboard with auto-routing and priority scoring |
| CM has no real-time governance visibility | Live executive intelligence dashboard with AI Copilot |
| Fraud and fake closures go undetected | AI fraud detection engine with anomaly scoring |
| No district-level performance comparison | Live heatmap + district analytics across all categories |

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER (Vercel)                         │
│  Next.js 16 App Router │ TailwindCSS │ Framer Motion │ Socket.IO Client│
│  Citizens │ Officers │ Department Heads │ District Admins │ CM │ Admin │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                REST + WebSocket
                                    │
┌──────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER (Render)                        │
│              Express.js + Socket.IO + TypeScript                       │
│    Copilot Chat │ Tracking API │ SMS Queue │ WhatsApp Webhooks          │
└──────────────────────────────────────────────────────────────────────┘
         │              │              │              │
    Firestore      PostgreSQL        Redis       Twilio/WhatsApp
   (Main DB)      (SMS Logs)   (BullMQ Queue)  (Notifications)
         │
    Pinecone          Gemini AI
   (Vectors)     (LLM + Embeddings)
```

---

## ✨ Feature Breakdown (Basic → Advanced)

### 1. Authentication System

**Level: Basic**

A multi-role authentication system built on Firebase Auth with role-based route protection.

- **Email/Password Registration & Login** — Secure sign-up with form validation
- **Role-Based Access Control (RBAC)** — 7 distinct roles: `Citizen`, `Officer`, `Department`, `District Admin`, `State Admin`, `Super Admin`, `CM`
- **Forgot Password** — Firebase email reset flow
- **Auth Context** — Global React context with persistent session management
- **Protected Routes** — Middleware-style layout-level guards that redirect unauthenticated users

```typescript
// Roles defined per user document in Firestore
{
  role: "citizen" | "officer" | "department" | "district" | "state-admin" | "super-admin" | "cm"
}
```

---

### 2. Citizen Portal

**Level: Basic → Intermediate**

The primary interface for citizens to submit, track, and manage their grievances.

#### 📝 Complaint Submission (`/citizen/submit`)
- **Multi-step form** with category, district, description, and photo upload
- **AI-Powered Validation** — Before submission, the image + description is analyzed by Gemini Vision to verify the complaint is genuine and not spam/duplicate
- **Auto-generated Complaint ID** — Format: `CMP-YYYYMMDD-XXXX` (e.g., `CMP-20260622-8712`)
- **Tracking Token Generation** — A unique secure token is generated for public anonymous tracking
- **Tracking URL** — A shareable public URL (`/track/[complaintId]?token=XXXX`) is created and shared with the citizen
- **Instant WhatsApp + SMS confirmation** — Citizen receives acknowledgment with complaint ID and tracking link

#### 📊 Complaint History (`/citizen/history`)
- View all past complaints with status badges
- Filter by status (Pending, In Progress, Resolved)
- View full details, timeline, and department assignment

#### 🔍 Complaint Tracking (`/citizen/track`)
- Track live status using complaint ID
- View complaint processing timeline steps

#### ⭐ Feedback System (`/citizen/feedback`)
- Rate resolution quality (1–5 stars)
- Citizen verification of resolution ("Is your issue resolved?")
- Feedback is used by the AI audit engine to flag suspicious closures

#### 👤 Profile & Settings (`/citizen/profile`, `/citizen/settings`)
- Update personal info, phone number, profile photo
- Notification preferences management

---

### 3. Officer Dashboard

**Level: Intermediate**

Field officers receive and process assigned complaints.

#### 📋 Assigned Cases (`/officer/assigned`)
- Real-time list of complaints assigned by department heads
- Priority-sorted with CRITICAL badges
- One-click status updates (In Progress → Resolved)
- Add resolution notes to each complaint

#### 🚨 Critical Cases (`/officer/critical`)
- Filtered view of CRITICAL priority complaints
- SLA countdown timers
- Escalation warnings

#### 📈 Officer Analytics (`/officer/analytics`)
- Personal resolution rate tracking
- Case closure speed metrics
- CSAT score from citizen feedback

#### 🔔 Notifications (`/officer/notifications`)
- Real-time alerts for new assignments
- Escalation warnings from the system
- WhatsApp-style notification center

---

### 4. Department Dashboard

**Level: Intermediate → Advanced**

Department heads oversee all complaints routed to their department.

#### 🏛️ Department Overview (`/department/page`)
- Real-time complaint count by status
- Officer performance within the department
- Auto-routing suggestions based on category

#### 👮 Officer Management (`/department/officers`)
- View all officers in the department
- Assign/reassign complaints to specific officers
- Monitor individual officer workloads

#### 📊 Department Analytics (`/department/analytics`)
- Resolution rate trends over time
- Category distribution charts (Recharts)
- Heatmap of complaint density by area

#### 📜 Reports (`/department/reports`)
- Generate department-specific PDF reports
- Monthly/weekly performance summaries

---

### 5. Chief Minister (CM) Command Center

**Level: Advanced**

The crown jewel of the platform — a real-time executive intelligence hub giving the CM full visibility into state governance.

#### 📊 CM Overview Dashboard (`/cm/page`)
- **Live KPI Cards** — Total complaints, resolution rate, CSAT score, escalated cases
- **Recharts Analytics** — Bar charts, line charts, area charts across districts and categories
- **Top & Worst Performing Districts** — Ranked by resolution rate
- **Critical Issue Monitor** — Real-time feed of CRITICAL-priority unresolved complaints
- **Resolution Trend Line** — 30-day historical resolution trend

#### 🗺️ Live Heatmap (`/cm/heatmap`)
- **Leaflet.js Interactive Map** — Complaints plotted geographically across Delhi
- **Hotspot Detection** — AI-computed clusters of high complaint density areas
- **Category Filters** — Toggle heatmap by category (Water, Roads, Health, etc.)
- **Real-time updates** — Socket.IO pushes new complaint pins in real-time

#### 🤖 AI Governance Copilot (`/cm/copilot`)

The most advanced feature — a Retrieval-Augmented Generation (RAG) chatbot for the CM.

- **Conversational AI Chat** — Ask questions in natural language about any aspect of governance
- **Live Firestore Context** — Every chat response is grounded in live Firestore data (not hallucinated)
- **Pinecone Vector Search** — Semantic search across historical complaint data using embeddings
- **Intent Detection Engine** — Automatically detects if the CM wants:
  - A conversational answer
  - A PDF briefing report
  - A district-specific speech draft
  - An executive governance audit
- **PDF Generation** — One-command generation of:
  - Daily Morning Briefing PDFs
  - Weekly Governance Audit Reports
  - Monthly Performance Summaries
  - Custom Speech Drafts
  - Executive Governance Reports
- **Visit Mode** — CM specifies a location (area + district); system generates:
  - Live complaint statistics for that area
  - Major issues briefing
  - Auto-drafted CM speech
  - Downloadable briefing PDF + speech PDF
- **Historical Briefings Archive** — All generated PDFs indexed in Firestore
- **Quick Prompts** — Pre-built one-click governance queries

#### 🧠 AI Insights (`/cm/ai-insights`)
- Predictive analytics on complaint trends
- AI-powered district performance forecasting
- Actionable recommendations

#### 🔍 AI Fraud & Accountability Audits (`/cm/copilot → Audits Tab`)
- **False Closure Detection** — Flags complaints marked resolved but citizen rated ≤2/5
- **Geofencing Mismatch** — Detects closures without valid GPS inspection coordinates
- **Bribery Anomaly Detection** — NLP scan of complaint text for corruption keywords
- **Risk Scores** — Each flagged officer gets a computed risk score (0–100)

#### 📋 Policy Recommendations (`/cm/copilot → Policies Tab`)
- AI-computed workforce redistribution recommendations
- Emergency budget allocation suggestions based on pending load

#### 🏛️ Department Intelligence (`/cm/departments`)
- Cross-department performance matrix
- SLA breach analysis
- Resolution velocity comparison

#### 📑 Reports (`/cm/reports`)
- Schedulable PDF reports
- Export to executive formats

---

### 6. State Admin Dashboard

**Level: Intermediate**

State-level administrators with oversight across all districts.

- **Cross-district performance dashboard**
- **User management** — Create/disable officer and department accounts
- **Complaint escalation management**
- **District-level analytics**
- **Report generation**

---

### 7. Super Admin Panel

**Level: Advanced**

Maximum-permission system administrators.

- **Platform-wide analytics**
- **User role management** — Grant/revoke roles
- **System health monitoring**
- **Database audit logs**
- **Configuration management**

---

### 8. AI & ML Engine

**Level: Advanced**

Multiple AI systems power the platform:

#### 🔍 Grievance Validator (`/api/validate-grievance`)
```
Image Upload → Gemini Vision API → Validity Score → Approve/Reject Submission
```
- Detects duplicate complaints
- Verifies photo relevance to description
- Assigns category suggestions

#### 🤖 Copilot RAG Pipeline
```
User Query
    → Gemini Text Embedding (text-embedding-004)
    → Pinecone Vector Search (cosine similarity)
    → Top-K Relevant Documents Retrieved
    → Firestore Live Data Injected as Context
    → Gemini 2.5 Flash Generates Response
    → Intent-Routed: Text / PDF / Insight
```

#### 📊 Analytics Engine (`compileCMExecutiveReportData`)
- Real-time computation of:
  - Resolution rates
  - CSAT averages
  - District performance rankings
  - Critical category counts (Women Safety, Floods, Infrastructure, Health, Corruption)
  - Audit flag detection

#### 🚨 Auto-Escalation Engine (`escalationService.ts`)
- Runs every 10 minutes
- Flags complaints that exceed SLA thresholds
- Auto-assigns CRITICAL priority
- Triggers WhatsApp escalation notifications

#### 🗺️ Heatmap Hotspot Engine (`heatmapService.ts`)
- Computes geographic complaint clusters
- Calculates hotspot severity scores
- Feeds real-time updates via Socket.IO

---

### 9. Notification System

**Level: Intermediate → Advanced**

A multi-channel notification system covering all complaint lifecycle events.

#### 📱 WhatsApp Business API
- **Complaint Submitted** — ID, tracking link, expected resolution time
- **Status Updates** — Every status change triggers a WhatsApp message
- **Escalation Alerts** — CRITICAL complaints trigger urgent WhatsApp notifications
- **Webhook Receiver** — Processes incoming citizen replies via WhatsApp

#### 📨 SMS via Twilio
- Templated SMS for all status transitions
- BullMQ queue-backed for reliability (no dropped SMS on high load)
- Daily rate limit: 20 SMS per citizen (anti-spam)
- Phone number masking in logs (GDPR)
- Twilio webhook for delivery status tracking

#### 🔔 In-App Notifications
- Real-time notification center per role
- Socket.IO-powered push without page refresh

#### 📧 Firebase Cloud Messaging (FCM)
- Push notification service for mobile browsers
- Complaint assignment notifications for officers

#### ⚙️ BullMQ Job Queue (`bullmqService.ts`)
- Redis-backed message queue for SMS reliability
- Retry logic for failed deliveries
- Job priority support
- Dashboard-ready queue metrics

---

### 10. Real-Time Infrastructure

**Level: Advanced**

#### 🔌 Socket.IO WebSocket Gateway
- Complaint status broadcast to citizen tracking page
- Live heatmap updates pushed to CM dashboard
- Officer assignment notifications
- SMS delivery status pushed to admin dashboard

#### Socket Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `track_complaint` | Client → Server | Join complaint room |
| `status_update` | Server → Client | Live status push |
| `heatmap_update` | Server → Client | New complaint pin |
| `sms_log_update` | Server → Client | SMS delivery status |

#### Horizontal Scaling
- Redis Pub/Sub adapter (`@socket.io/redis-adapter`) for multi-instance Socket.IO
- Configurable via `REDIS_HOST` environment variable

---

### 11. PDF Generation Engine

**Level: Advanced**

Server-side PDF generation using PDFKit (no client-side PDF).

#### Report Types Generated

| Report | Description | Pages |
|--------|-------------|-------|
| **CM Executive Report** | Full governance briefing with all metrics, AI analysis, district rankings | Multi-page |
| **Daily Grievance Ledger** | Tabulated list of all complaints with status | Dynamic |
| **Visit Briefing** | District-specific briefing for CM field visits | 2-page |
| **CM Speech PDF** | Professionally formatted speech draft | 1-page |
| **Custom Topic PDF** | Any Gemini-generated text as formatted PDF | Dynamic |
| **Periodic Briefings** | Daily/Weekly/Monthly auto-compiled audit reports | Multi-page |

#### PDF Features
- Official government header/footer styling
- Dynamic tables with complaint data
- Color-coded status indicators
- District/department performance charts embedded as text visualizations
- AI-generated narrative analysis blocks
- Digital timestamp and generation metadata

---

### 12. Public Complaint Tracking

**Level: Intermediate**

A fully anonymous, no-login-required tracking page.

**URL Format:** `https://apka-sikayat.vercel.app/track/[complaintId]?token=[trackingToken]`

#### Security Flow
```
1. Citizen opens tracking URL
2. Frontend reads complaintId from URL path
3. Frontend reads token from ?token= query param
4. Backend GET /api/complaints/track/:complaintId?token=XXXX
5. Firebase Admin SDK queries Firestore by document ID
6. Falls back to Client SDK query by complaintId field
7. Token validated against stored trackingToken
8. 403 returned if token mismatch
9. 404 returned if complaint not found
10. Full complaint data returned if valid
```

#### Tracking Page Displays
- Complaint ID and category
- Current status with color-coded badge
- Processing timeline with step indicators
- Assigned department
- Resolution notes (when available)
- Submission date

#### Real-Time Updates
- Socket.IO connection listens for `status_update` events
- Page updates automatically when officer changes status — no refresh needed

---

### 13. Security & Compliance

**Level: Advanced**

| Feature | Implementation |
|---------|----------------|
| **Phone Masking** | All phone numbers masked in admin SMS logs (e.g., `+91******5678`) |
| **Rate Limiting** | Max 30 tracking API requests/minute per IP, Max 20 SMS/day per citizen |
| **Token Validation** | Tracking URLs require a unique token — prevents unauthorized access |
| **Twilio Signature Verification** | Webhook requests validated via HMAC signature in production |
| **CORS Policy** | Whitelist-based origin control for all API endpoints |
| **Environment Isolation** | All secrets in `.env`, never in source code |
| **Graceful Shutdown** | SIGTERM/SIGINT handlers close DB, Redis, and HTTP server cleanly |
| **Role Guards** | All dashboard routes server-validated by Firebase Auth role claims |

---

## 📁 Project Structure

```
Apka-Sikayat/
├── frontend/                      # Next.js 16 Application
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/             # Login page
│   │   │   ├── register/          # Registration page
│   │   │   └── forgot-password/   # Password reset
│   │   ├── (dashboards)/
│   │   │   ├── citizen/
│   │   │   │   ├── submit/        # Grievance submission form
│   │   │   │   ├── history/       # Complaint history
│   │   │   │   ├── track/         # Citizen tracking view
│   │   │   │   ├── feedback/      # Post-resolution feedback
│   │   │   │   ├── notifications/ # Notification center
│   │   │   │   ├── profile/       # Profile management
│   │   │   │   └── settings/      # Preferences
│   │   │   ├── officer/
│   │   │   │   ├── assigned/      # Assigned complaints
│   │   │   │   ├── critical/      # Critical case monitor
│   │   │   │   ├── analytics/     # Officer metrics
│   │   │   │   └── notifications/
│   │   │   ├── department/
│   │   │   │   ├── officers/      # Officer management
│   │   │   │   ├── analytics/     # Department analytics
│   │   │   │   ├── reports/       # Report generation
│   │   │   │   └── notifications/
│   │   │   ├── cm/
│   │   │   │   ├── page.tsx       # CM Command Center
│   │   │   │   ├── copilot/       # AI Governance Copilot
│   │   │   │   ├── heatmap/       # Live complaint heatmap
│   │   │   │   ├── ai-insights/   # Predictive AI insights
│   │   │   │   ├── analytics/     # Deep analytics
│   │   │   │   ├── departments/   # Department intelligence
│   │   │   │   ├── reports/       # Executive reports
│   │   │   │   ├── settings/
│   │   │   │   └── notifications/
│   │   │   ├── district/          # District admin dashboard
│   │   │   ├── state-admin/       # State admin dashboard
│   │   │   └── super-admin/       # Super admin panel
│   │   ├── track/
│   │   │   └── [complaintId]/     # Public anonymous tracking page
│   │   ├── api/                   # Next.js API routes
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/                # Shared React components
│   ├── context/                   # React context providers
│   ├── lib/
│   │   └── firebase.ts            # Firebase client config
│   └── public/                    # Static assets
│
├── backend/                       # Express.js API Server
│   ├── src/
│   │   ├── server.ts              # Main app entry + all routes
│   │   ├── controllers/
│   │   │   ├── copilotController.ts   # AI Copilot + PDF endpoints
│   │   │   └── whatsappController.ts  # WhatsApp webhook handlers
│   │   ├── services/
│   │   │   ├── pineconeService.ts     # Vector search + embeddings
│   │   │   ├── pdfService.ts          # PDFKit report generation
│   │   │   ├── eventService.ts        # Firestore complaint updates
│   │   │   ├── escalationService.ts   # Auto-escalation engine
│   │   │   ├── heatmapService.ts      # Geospatial hotspot engine
│   │   │   ├── bullmqService.ts       # Redis BullMQ SMS queue
│   │   │   ├── smsService.ts          # SMS sending service
│   │   │   ├── whatsappService.ts     # WhatsApp Business API
│   │   │   ├── twilioService.ts       # Twilio SMS integration
│   │   │   ├── grievanceValidator.ts  # AI complaint validator
│   │   │   ├── databaseService.ts     # PostgreSQL SMS log DB
│   │   │   ├── rateLimiter.ts         # Per-citizen rate limiting
│   │   │   ├── cryptoService.ts       # Phone number masking
│   │   │   ├── fcmService.ts          # Firebase Cloud Messaging
│   │   │   ├── templateManager.ts     # SMS/WhatsApp templates
│   │   │   ├── queueService.ts        # Legacy in-memory queue
│   │   │   └── urlHelper.ts           # Tracking URL generation
│   │   ├── config/
│   │   │   └── firebaseAdmin.ts       # Firebase Admin SDK init
│   │   └── workers/
│   │       ├── notificationWorker.ts  # BullMQ job processor
│   │       └── briefingWorker.ts      # Scheduled PDF generator
│   ├── firebase.ts                # Firebase client SDK (backend)
│   └── tsconfig.json
│
├── render.yaml                    # Render.com deployment config
├── package.json                   # Root workspace config
└── README.md
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 16.x | React framework with App Router |
| **TypeScript** | 6.x | Type-safe development |
| **TailwindCSS** | 4.x | Utility-first styling |
| **Framer Motion** | 12.x | Animations & transitions |
| **Lucide React** | 1.21 | Icon library |
| **Recharts** | 3.x | Data visualization charts |
| **Leaflet + React Leaflet** | 1.9/5.x | Interactive maps (heatmap) |
| **Socket.IO Client** | 4.x | Real-time WebSocket connection |
| **React Hook Form + Zod** | Latest | Form management + validation |
| **Firebase SDK** | 12.x | Auth + Firestore client |
| **Framer Motion** | 12.x | Page transitions and micro-animations |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Node.js + Express.js** | 4.x | HTTP API server |
| **TypeScript** | 5.x | Type-safe server code |
| **Socket.IO** | 4.x | WebSocket real-time server |
| **Firebase Admin SDK** | 12.x | Privileged Firestore access |
| **BullMQ** | 5.x | Redis-backed job queue |
| **IORedis** | 5.x | Redis client |
| **PDFKit** | 0.19 | Server-side PDF generation |
| **Twilio** | 6.x | SMS sending |
| **PostgreSQL (pg)** | 8.x | SMS audit log database |
| **dotenv** | 16.x | Environment configuration |

### AI / ML
| Service | Purpose |
|---------|---------|
| **Gemini 2.5 Flash** (`gemini-2.5-flash`) | Conversational AI responses |
| **Gemini Text Embedding** (`text-embedding-004`) | Vector embeddings for RAG |
| **Gemini Vision** | Image validation for complaint submissions |
| **Pinecone** | Vector database for semantic search |

### Infrastructure
| Service | Purpose |
|---------|---------|
| **Firebase Firestore** | Primary NoSQL database |
| **Firebase Auth** | User authentication |
| **Firebase FCM** | Push notifications |
| **Vercel** | Frontend hosting + CDN |
| **Render** | Backend + Socket.IO hosting |
| **Twilio** | SMS delivery |
| **WhatsApp Business API** | WhatsApp notifications |
| **Redis** | BullMQ queue + Socket.IO scaling |
| **PostgreSQL** | SMS delivery logs |

---

## 🚀 Getting Started

### Prerequisites

Ensure the following are installed:
- **Node.js** v18+ (`node -v`)
- **npm** v9+ (`npm -v`)
- A **Firebase project** with Firestore and Auth enabled
- A **Twilio account** with an SMS-capable phone number
- A **WhatsApp Business API** account (or Meta Developer App)
- A **Pinecone** account with an index created
- A **Google AI Studio** Gemini API key

### Environment Variables

Create `frontend/.env` (single source of truth, read by both frontend and backend):

```bash
# ─── Firebase (Client SDK) ───────────────────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# ─── Gemini AI ───────────────────────────────────────────────────
GEMINI_API_KEY=your_gemini_api_key
GEMINI_API_KEY_CITIZEN=your_citizen_gemini_key  # optional secondary key

# ─── Pinecone Vector Database ────────────────────────────────────
PINECONE_API_KEY=pcsk_xxxxxxxxxxxxxxxxxxxxxxxx
PINECONE_INDEX_HOST=https://your-index.svc.aped-xxxx.pinecone.io

# ─── Twilio SMS ──────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# ─── WhatsApp Business API ───────────────────────────────────────
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_number_id
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_GEMINI_API_KEY=your_whatsapp_gemini_key

# ─── Security ────────────────────────────────────────────────────
SMS_ENCRYPTION_KEY=32_character_hex_string_here

# ─── API URL (Production) ────────────────────────────────────────
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

For **Firebase Admin SDK** (backend only), create `backend/src/config/serviceAccount.json`:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com",
  ...
}
```

### Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/davy-anii/Apka-Sikayat.git
cd Apka-Sikayat

# 2. Install all dependencies
npm install
npm install --prefix frontend
npm install --prefix backend --legacy-peer-deps

# 3. Configure environment
cp frontend/.env.example frontend/.env
# Fill in your credentials in frontend/.env

# 4. Start both frontend and backend simultaneously
npm run dev:frontend    # Starts Next.js on http://localhost:5001
npm run dev:backend     # Starts Express on http://localhost:5002

# OR start both with a single command:
npm run dev
```

#### Verify Setup
```bash
# Check backend health
curl http://localhost:5002/health

# Test AI Copilot
curl -X POST http://localhost:5002/api/cm/copilot/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "How many complaints do we have?"}'

# Test tracking API
curl "http://localhost:5002/api/complaints/track/CMP-20260622-0001?token=your_token"
```

---

## 🌐 API Reference

### Complaint Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/complaints/track/:complaintId?token=:token` | Public complaint tracker |
| `POST` | `/api/complaints/:id/status` | Update complaint status (auth required) |

### AI Copilot

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cm/copilot/chat` | Conversational AI with RAG |
| `POST` | `/api/cm/copilot/generate-executive-report` | Generate CM executive PDF |
| `POST` | `/api/cm/copilot/generate-custom-pdf` | Generate custom topic PDF |
| `POST` | `/api/cm/copilot/visit` | Visit intelligence + speech |
| `GET` | `/api/cm/copilot/briefings` | List briefing archive |
| `POST` | `/api/cm/copilot/briefings/generate` | Generate periodic briefing PDF |
| `GET` | `/api/cm/copilot/audits` | AI fraud detection results |
| `GET` | `/api/cm/copilot/policies` | Policy recommendations |

### Heatmap

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cm/heatmap/live-data` | Current hotspot state |
| `POST` | `/api/cm/heatmap/sync` | Trigger hotspot recalculation |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/validate-grievance` | AI image + text validation |
| `GET` | `/api/admin/sms-logs` | SMS delivery audit logs |
| `POST` | `/api/admin/trigger-escalations` | Manual escalation cycle |
| `GET` | `/api/webhooks/whatsapp` | WhatsApp webhook verification |
| `POST` | `/api/webhooks/whatsapp` | WhatsApp message events |
| `POST` | `/api/webhooks/twilio` | Twilio delivery callbacks |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | System health check |
| `POST` | `/api/internal/broadcast` | Internal Socket.IO broadcast |

---

## 🗃️ Firestore Data Schema

### `complaints` Collection

```typescript
{
  // Identity
  id: string,                   // Document ID (same as complaintId)
  complaintId: string,          // "CMP-YYYYMMDD-XXXX"
  trackingToken: string,        // Unique secure tracking token
  trackingLink: string,         // Full public tracking URL

  // Complaint Data
  title: string,
  description: string,
  category: string,             // "Water", "Roads", "Health", etc.
  district: string,
  location: { lat: number, lng: number },

  // Status Lifecycle
  status: "Submitted" | "Under Review" | "In Progress" | "Resolved" | "Closed" | "Escalated" | "Citizen_Verified",
  priority: "Normal" | "High" | "CRITICAL",
  isEscalated: boolean,

  // Assignment
  department: string,
  assignedOfficer: string,

  // Citizen
  uid: string,
  citizenId: string,
  phoneNumber: string,

  // Resolution
  resolutionNotes: string,
  feedback: {
    rating: number,             // 1-5
    comment: string,
    submittedAt: Timestamp
  },

  // Audit
  timeline: Array<{
    status: string,
    updatedBy: string,
    timestamp: Timestamp,
    notes: string
  }>,

  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### `copilot_briefings` Collection
```typescript
{
  id: string,           // "BR-DAILY-timestamp"
  type: "daily" | "weekly" | "monthly",
  name: string,
  desc: string,
  date: string,
  createdAt: string,
}
```

---

## 👥 User Roles & Permissions

| Role | Login Route | Dashboard | Key Permissions |
|------|-------------|-----------|-----------------|
| **Citizen** | `/login` | `/citizen` | Submit complaints, track own complaints, give feedback |
| **Officer** | `/login` | `/officer` | View assigned complaints, update status, add notes |
| **Department** | `/login` | `/department` | Manage officers, view dept complaints, generate reports |
| **District Admin** | `/login` | `/district` | Cross-department oversight for a district |
| **State Admin** | `/login` | `/state-admin` | State-wide analytics, user management |
| **Super Admin** | `/login` | `/super-admin` | Full system control, role management |
| **CM** | `/login` | `/cm` | Executive intelligence, AI Copilot, heatmap, all analytics |

---

## 📊 Complaint Lifecycle

```
Citizen Submits (AI Validated)
         │
         ▼
   [Submitted] → WhatsApp + SMS sent with Tracking URL
         │
         ▼ (Department reviews)
  [Under Review]
         │
         ▼ (Assigned to Officer)
   [In Progress] → WhatsApp + SMS sent
         │
     ┌───┤
     │   └── SLA breached → Auto-escalation to CRITICAL
     │
     ▼ (Officer resolves)
   [Resolved] → WhatsApp + SMS sent with resolution notes
         │
         ▼ (Citizen rates 1-5 ★)
 [Citizen_Verified] ──── Rating ≤ 2 → AI Audit Flag (Potential Fake Closure)
         │
         ▼
      [Closed]
```

---

## 🤖 AI Copilot Architecture

```
CM Types Question
       │
       ▼
POST /api/cm/copilot/chat
       │
       ├── Intent Detected: PDF/Report?
       │      ├── isCustomTopic → Speech/Directive PDF
       │      └── isExecutiveReport → Full Governance PDF
       │
       └── Intent Detected: Conversation?
              │
              ├── Fetch all complaints from Firestore
              │      (Live real-time data)
              │
              ├── Build context blocks (30 top complaints)
              │
              ├── Gemini 2.5 Flash API Call
              │      (System prompt + Live context + CM query)
              │
              └── Return structured response
                     ├── type: "text" → Chat bubble
                     ├── type: "insight" → AI recommendation card
                     └── type: "pdf_download" → Download button
```

---

## 📱 Notification Channels

### WhatsApp Message Templates

**On Complaint Submission:**
```
✅ Complaint Received — Apka Sikayat

Complaint ID: CMP-20260622-8712
Category: Water Pipeline Leakage
District: South West Delhi
Priority: High

Track your complaint:
https://apka-sikayat.vercel.app/track/CMP-20260622-8712?token=xxxxx

Expected Resolution: 7 Working Days
```

**On Status Update:**
```
*Complaint Update*

*Complaint ID*: CMP-20260622-8712
*New Status*: In Progress
*Track Here*: https://apka-sikayat.vercel.app/track/...
```

**On Critical Escalation:**
```
🚨 IMMEDIATE ACTION REQUIRED

Complaint CMP-20260622-8712 has been escalated to CRITICAL status.
This case requires urgent departmental attention.
```

---

## 🚢 Deployment Guide

### Frontend → Vercel

```bash
# Automatic: Connect GitHub repo to Vercel
# Manual:
vercel --prod
```

Set these environment variables in Vercel Dashboard:
- All `NEXT_PUBLIC_*` Firebase vars
- `NEXT_PUBLIC_API_URL` = your Render backend URL

### Backend → Render

The `render.yaml` at the root automates deployment:

```bash
# Push to main branch → Render auto-builds and deploys
git push origin main
```

Set these in Render Environment Variables:
- `GEMINI_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_HOST`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- All `NEXT_PUBLIC_FIREBASE_*` vars (read by backend for Firebase Client SDK)

### Build Commands

```bash
# Full production build
npm run build          # Builds both frontend + backend

# Individual builds
npm run build:frontend
npm run build:backend

# Start production servers
npm run start          # Starts both frontend (5001) + backend (5002)
```

---

## 🔐 Security Features

- **No Secrets in Code** — All credentials loaded from `.env`, never committed
- **Token-Based Tracking** — Tracking URLs require valid `trackingToken` matching Firestore record
- **Rate Limiting** — IP-based rate limiting (30 req/min) on public tracking endpoint; citizen SMS capped at 20/day
- **Phone Masking** — All phone numbers masked in admin-visible SMS logs (`+91****5678`)
- **CORS Whitelist** — Only allowed origins can call the backend API
- **Twilio Signature Validation** — Webhook requests verified via HMAC in production
- **Firebase Security Rules** — Role-based read/write rules on Firestore collections
- **Graceful Shutdown** — DB connections closed cleanly on SIGTERM (prevents data loss)

---

## 📈 Roadmap

### Near-Term
- [ ] **Hindi language support** — Full UI translation for native Hindi users
- [ ] **Mobile App (React Native)** — iOS and Android companion apps
- [ ] **Offline Mode** — PWA with service worker for areas with poor connectivity
- [ ] **Voice Complaint** — Submit grievances via voice recording (speech-to-text)

### Medium-Term
- [ ] **Multi-state support** — Configurable for any Indian state
- [ ] **AI Officer Recommendation** — Auto-assign complaints to best-suited officer using ML
- [ ] **Citizen App with Aadhaar** — Identity verification via Aadhaar API integration
- [ ] **Advanced Fraud Detection** — BERT-based NLP model for deeper corruption detection

### Long-Term
- [ ] **National Grievance Network** — Integration with CPGRAMS (Central Government portal)
- [ ] **Blockchain Audit Trail** — Immutable complaint history on a permissioned ledger
- [ ] **Predictive Governance** — ML models to predict complaint surges before they happen
- [ ] **IoT Integration** — Automatic complaint generation from smart city sensors (e.g., broken streetlights)

---

## 🤝 Contributing

Contributions are welcome! Please follow this workflow:

```bash
# 1. Fork the repository
# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make your changes
# 4. Run linting
npm run lint

# 5. Commit with a meaningful message
git commit -m "feat: add your feature description"

# 6. Push and create a Pull Request
git push origin feature/your-feature-name
```

### Commit Convention
- `feat:` — New feature
- `fix:` — Bug fix
- `style:` — UI/styling changes
- `refactor:` — Code restructuring
- `docs:` — Documentation updates
- `chore:` — Build/config changes

---

<div align="center">

### Built with ❤️ for the citizens of Delhi

**Live App:** [apka-sikayat.vercel.app](https://apka-sikayat.vercel.app)  
**Backend API:** [apka-sikayat.onrender.com](https://apka-sikayat.onrender.com/health)

*Empowering citizens. Transforming governance. One grievance at a time.*

</div>
