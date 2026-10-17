# RealityOS — Cognitive Operating System for Intelligent Infrastructure

> **Plan the future. Simulate reality. Build with intelligence.**  
> Transform complex infrastructure ideas into explainable, data-driven execution strategies. Connect geography, engineering, finance, and environmental intelligence in one unified planning workspace.

---

## 1. Executive Overview

Large-scale infrastructure planning is fragmented across engineering teams, municipal departments, geographic datasets, technical documents, financial models, environmental studies, and disconnected software tools. A routine corridor shift or station repositioning often triggers unforeseen utility clashes, land acquisition bottlenecks, and multimillion-rupee budget overruns.

**RealityOS** solves this fragmentation by unifying the entire planning lifecycle:
- **Command Center:** Executive portfolio overview, interactive metro network schematic, and risk posture.
- **Project Register:** Create, filter, sort, and govern major infrastructure programmes with live persistence.
- **AI Planning Studio:** Five coordinated planning agents (Transportation, Finance, Environment, Utilities, Risk) turn natural-language briefs into structured, explainable planning reports.
- **Geo Intelligence:** Live layered GIS map (Leaflet) with candidate alignment scoring, station catchments, and terrain overlays.
- **Digital Twin & Scenario Lab:** Deterministic scenario engine with reproducible Monte Carlo simulation comparing cost, timeline, capacity, and sustainability.
- **Knowledge Graph:** Typed dependency graph connecting budgets, utility crossings, land parcels, and statutory regulations.
- **Reports & Evidence:** Persisted DPR documents with genuine, readable PDF export.
- **Workspace Settings & Diagnostics:** Currency, simulation parameters, and real-time AI connection probe.

### Primary Demonstration Project: Metro Intelligence
- **Corridor Length:** 68 km planned metropolitan rail network across two trunk corridors.
- **Stations:** 42 proposed stations with 3 strategic interchange hubs.
- **Capital Envelope:** ₹18,500 crore baseline estimate.
- **Target Completion:** 2032 (Scenario Evaluation status).

---

## 2. Technology Stack & Architecture

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript.
- **Styling & Design System:** Vanilla CSS / Tailwind CSS v4 design tokens, glassmorphism, dark-mode `#0A0B0D` aesthetics, and micro-animations.
- **Database & ORM:** PostgreSQL with Drizzle ORM (`drizzle-orm`, `pg`), complete with seamless in-memory fallback for instant evaluation.
- **Authentication & Security:** Supabase Auth with Row-Level Security (RLS) policies, session persistence, and seamless Demo Planner profile fallback.
- **AI Intelligence Gateway:** Server-side Google Gemini 2.5 Flash with 30s timeout, response schema validation, and deterministic heuristic fallback.
- **Geographic & Twin Visualization:** Leaflet GIS maps (`react-leaflet`), Recharts, and custom SVG Metro transit diagrams.
- **Evidence Generation:** Client-side vector PDF generation (`jspdf`).

---

## 3. Directory Structure

```
Reality-OS/
├── src/
│   ├── app/
│   │   ├── (marketing)/           # Landing page with 3D Globe, Privacy, Terms
│   │   ├── (auth)/                # Login, Signup, Forgot/Reset Password, Onboarding
│   │   ├── (app)/                 # Protected application modules
│   │   │   ├── overview/          # Command Center & Metro schematic
│   │   │   ├── projects/          # Project Register & Project details
│   │   │   ├── studio/            # AI Planning Studio
│   │   │   ├── geo/               # Geo Intelligence map
│   │   │   ├── twin/              # Digital Twin & Scenario Lab
│   │   │   ├── graph/             # Knowledge Graph
│   │   │   ├── reports/           # Reports & Evidence
│   │   │   └── settings/          # Workspace Settings & AI diagnostics
│   │   └── api/                   # Server-side API endpoints
│   │       ├── ai/                # Gemini integration & status probe
│   │       ├── projects/          # Project CRUD
│   │       ├── reports/           # Report CRUD
│   │       └── health/            # System health probe
│   ├── components/                # Reusable UI components & providers
│   ├── db/                        # Drizzle ORM schema & Postgres client
│   └── lib/                       # Auth store, simulation engine, seed data
├── supabase/
│   └── schema.sql                 # Complete Postgres DDL & Supabase RLS policies
├── .env.example                   # Environment configuration template
└── package.json
```

---

## 4. Getting Started & Local Development

### Prerequisites
- Node.js 18.x or higher
- npm 9.x or higher

### Installation
```bash
# Clone the repository and navigate to the project directory
cd Reality-OS

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### Running the Application
```bash
# Start Next.js development server
npm run dev

# Or run typecheck to verify types
npm run typecheck

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Environment Configuration

RealityOS is designed to work immediately out of the box with zero external configuration using its deterministic demo dataset and in-memory store. To connect live external services, configure `.env.local`:

```env
# Database (PostgreSQL / Supabase)
DATABASE_URL="postgresql://postgres:password@db.your-project.supabase.co:5432/postgres"

# Authentication (Supabase)
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# AI Planning (Google Gemini — Server-side only)
GEMINI_API_KEY="your-gemini-api-key"
```

---

## 6. Authentication & Demo Mode

- **Evaluation / Demo Mode:** When Supabase credentials are not present, or by clicking **"Continue as Lead Planner"**, the app grants instant access under the profile `Lead Infrastructure Planner` (`Metropolitan Development Authority`).
- **Production Mode:** When `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are provided, the application connects directly to Supabase Auth with full signup verification and password reset workflows.
