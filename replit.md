# Astro Orb - AI-Powered Astrology Telegram Mini App

## Overview

Astro Orb is an AI-powered Telegram Mini App providing astrology readings, including natal charts, solar returns, horoscopes, and personalized insights. It features a gamified energy system, TON blockchain payment integration, and referral mechanics. The project aims to deliver accurate astrological interpretations using OpenAI and precise astronomical calculations, packaged in a user-friendly, full-stack TypeScript application with a React frontend and Express backend.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Routing:**
- React 18 with TypeScript and Vite.
- Lightweight client-side routing using wouter.
- shadcn/ui with Radix UI primitives for components.
- Tailwind CSS for styling, adhering to Telegram's native aesthetic.

**State Management:**
- Zustand for global state (authentication, energy).
- TanStack Query for server state management and API caching.
- React Hook Form with Zod for form handling.

**Design System:**
- Dark mode primary, adaptive to Telegram colors.
- Custom cosmic purple/blue theme.
- Typography: Inter (primary), Syne (headings), JetBrains Mono (data).
- Design inspiration from Telegram native UI, Duolingo gamification, Co-Star, and Notion.
- Key features include Telegram WebApp SDK integration, TON Connect UI, canvas-based natal chart visualization, real-time energy countdown, and multi-step registration.

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript, using `tsx` for development and `esbuild` for production.

**Authentication & Security:**
- JWT-based authentication with 30-day expiry.
- Telegram InitData validation using HMAC-SHA256.
- Custom auth middleware for protected routes.

**API Structure:**
- RESTful endpoints under `/api` for authentication, astrology, payments, referrals, and user management.

**Astrology Engine:**
- Utilizes Swiss Ephemeris for NASA-grade accurate astronomical calculations (e.g., `astronomia`, `astronomy-engine` libraries via Python bridge).
- Generates natal charts, solar returns, horoscopes, and compatibility analyses.

**Business Logic:**
- Gamified energy system with timezone-aware daily resets.
- Configurable energy costs for features.
- Subscription tiers (Standard, Pro).
- Referral rewards for user acquisition.

### Data Storage

**Database:**
- PostgreSQL via Neon serverless with Drizzle ORM for type-safe queries.
- Schema includes `users`, `subscriptions`, `payments`, `usageLogs`, and dedicated tables for `natal_readings`, `horoscope_readings`, `compatibility_readings`, and `ai_questions` to persist astrology readings.

## External Dependencies

**Telegram Integration:**
- `@twa-dev/sdk` for Mini App functionality, InitData validation, and native UI controls.

**Blockchain/Payment:**
- TON Connect UI React (`@tonconnect/ui-react`) for wallet connection.
- TON API for price fetching and secure transaction verification, including replay protection.
- Manifest served at `/.well-known/tonconnect-manifest.json`.

**AI Services:**
- OpenAI API (GPT-5) via Replit AI Integrations for astrological interpretations.
- Custom prompts for various reading types (natal, solar return, horoscope, compatibility, custom questions) supporting multi-language content generation.

**Environment Variables:**
- `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `TON_PRICE_FALLBACK_USD_PER_TON`, `VITE_BOT_USERNAME`, `TON_WALLET_ADDRESS`, `SESSION_SECRET`.

## Recent Changes (October 12, 2025)

**Deployment ES Module Fix (Complete):**
- Added `.js` extensions to all dayjs plugin imports for ES module compatibility
- Fixed imports in: `server/lib/energy.ts`, `client/src/pages/Register.tsx`, `client/src/pages/Settings.tsx`
- Changed `dayjs/plugin/timezone` → `dayjs/plugin/timezone.js`
- Changed `dayjs/plugin/utc` → `dayjs/plugin/utc.js`
- Node.js production environment now properly resolves ES module imports
- Application ready for deployment

**TypeScript Type Safety Improvements (Complete):**
- Fixed all TypeScript compilation errors and LSP diagnostics
- Replaced all unsafe `any` types with proper interfaces in chart processing
- Created `StoredNatalChart` interface extending `NatalChartResult` for database persistence
- Added runtime guards for `user.natalChart` validation before type assertions
- Removed `[string, any]` destructuring patterns in Object.entries transformations
- Added `createPaymentSchema` Zod validation for payment tier before database operations
- Updated Dashboard and Settings `useQuery` with concrete `UserMeResponse` type using shared `User` and `Subscription` types
- Fixed user creation flow to properly initialize energy and energyResetAt fields after user creation
- Added runtime tier validation (`"standard" | "pro"`) in payment webhook
- All astrology endpoints (natal, horoscope, compatibility) now use properly typed `NatalChartResult`
- Zero LSP errors, zero compilation warnings - fully type-safe codebase

**Swiss Ephemeris Integration (Complete):**
- All astrology features now use Swiss Ephemeris for NASA-grade accuracy (±0.01° using DE431 ephemerides)
- Extended to compatibility, solar return, and horoscope calculations
- Python-Node.js bridge working correctly
- Natal charts are FREE - no energy cost
- Charts cached in database for instant loading on revisit

**Localization Fixes (Complete):**
- Fixed Russian welcome message with proper placeholder replacement
- All error messages and toasts properly localized

## Recent Changes (October 13, 2025)

**AI Tone Personalization System (Complete):**
- Implemented gender-based AI response personalization for all astrology features
- Created `personalizeTone()` function with gender-aware tone instructions (male/female/other)
- Migrated all AI prompts to markdown files in `server/lib/prompts/` for better maintainability
- Prompt system with placeholder replacement (`{{DATA}}`, `{{TONE_INSTRUCTION}}`)
- Full integration across natal charts, solar returns, horoscopes, compatibility, AI Q&A, and planet interpretations
- All API routes now pass user.gender to AI functions
- README.md created with detailed documentation of personalization feature
- Women receive warmer, more empathetic tone; men receive concrete, confident tone; others get balanced neutral tone
- All responses remain human-friendly and avoid robotic AI language

**Natal Chart Caching & Onboarding System (Complete):**
- **Database Architecture**: Created dedicated `natalCharts` (user's own chart, one per user) and `externalNatals` (guest charts for compatibility, many per user) tables
- **Caching Service**: Implemented `natalService.ts` with `ensureUserNatalChart()`, `computeNatalFromUser()`, and `recomputeIfProfileChanged()` functions
- **API Endpoints**:
  - `POST /api/natal/init` - Create user's natal chart (FREE, cached forever)
  - `GET /api/natal/me` - Retrieve cached chart with auto-recalculation on profile change
  - `POST /api/natal/recalculate` - Force recalculation of user's chart (FREE)
  - `POST /api/natal/external` - Create guest chart (1 orb each)
  - `GET /api/natal/external` - List all guest charts
- **Energy Model Update**: Own natal chart FREE (created once), guest charts cost 1 orb each, compatibility analysis uses guest charts
- **Onboarding UX**:
  - Dashboard shows Coachmark component when `natalInitialized: false`
  - All features blocked until user creates natal chart
  - NatalChart page includes GuestChartForm for creating guest charts
  - Compatibility page allows selecting from saved guest charts
- **Backend Integration**: Updated `/api/astrology/natal` to use new caching system, `/api/user/me` returns `natalInitialized` flag
- **Frontend Components**: `Coachmark.tsx` for onboarding prompts, `GuestChartForm.tsx` for guest chart creation

**UI Separation & Auto-Recalculation (Complete):**
- **Separate Pages**: Created `MyNatalChart.tsx` for user's own chart (FREE, cached) and updated `NatalChart.tsx` exclusively for guest charts (1 orb each)
- **Dashboard Updates**: Split natal chart functionality into two buttons:
  - "My Natal Chart" → `/my-natal-chart` route (FREE access to cached chart)
  - "Guest Charts" → `/natal-chart` route (1 orb per guest chart)
- **Auto-Recalculation**: GET `/api/natal/me` automatically invokes `recomputeIfProfileChanged()` before returning, ensuring profile edits (birth date/time/location) trigger FREE recalculation without energy cost
- **Data Normalization**: `MyNatalChart.tsx` includes `Array.isArray()` guard to transform cached planet objects `{Sun: {...}, Moon: {...}}` into arrays `[{name: "Sun", ...}, ...]` for ChartCanvas compatibility
- **Manual Recalculation**: Added "Recalculate Chart" button in `MyNatalChart.tsx` using POST `/api/natal/recalculate` endpoint for manual refresh without energy deduction