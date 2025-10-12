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