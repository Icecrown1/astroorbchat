# Astro Orb - AI-Powered Astrology Telegram Mini App

## Overview
Astro Orb is an AI-powered Telegram Mini App offering personalized astrology readings like natal charts, solar returns, and horoscopes. It integrates a gamified energy system, TON blockchain payments, and referral mechanics. The project aims to deliver accurate, AI-driven astrological interpretations within a user-friendly, full-stack TypeScript application with a React frontend and Express backend. Its core purpose is to make complex astrological insights accessible and engaging.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
- **Frontend**: React 18, TypeScript, Vite, wouter for routing.
- **Styling**: shadcn/ui, Radix UI, Tailwind CSS, dark mode with a cosmic theme, Telegram native UI aesthetics.
- **State Management**: Zustand for global state, TanStack Query for server state, React Hook Form with Zod for forms.
- **Key Features**: Telegram WebApp SDK, TON Connect UI, canvas-based natal chart visualization, real-time energy countdown, multi-step registration.

### Technical Implementation
- **Backend**: Express.js with TypeScript.
- **Authentication**: JWT-based with Telegram InitData validation (HMAC-SHA256) and Telegram Login Widget support.
- **API**: RESTful endpoints for authentication, astrology, payments, referrals, and user management.
- **Astrology Engine**: Python-based Swiss Ephemeris for precise astronomical calculations (natal charts, solar returns, horoscopes, compatibility).
- **AI Integration**: OpenAI (GPT-5) via Replit AI Integrations for astrological interpretations, utilizing custom, compact prompts for various reading types and gender-based tone personalization. Includes full localization of prompts and ensures personalized compatibility readings with user names.
- **Horoscope System**: Offers daily, weekly, and monthly personalized horoscopes, deeply integrated with natal chart data for individual predictions, not generic readings. Horoscopes are stored with `startDate` and `endDate` for proper period tracking.
- **Business Logic**: Gamified energy system with daily resets, configurable feature costs, subscription tiers, and referral rewards. Users can update their profile once every 30 days.

### System Design Choices
- **Data Caching**: Multi-locale caching for natal charts with on-demand locale generation.
- **Payment Systems**:
    - **TON Blockchain**: Cryptocurrency payments via TON Connect, with server-side blockchain verification for transactions.
    - **Telegram Stars**: In-app purchases with server-side price validation, webhook security, and idempotency checks.
- **Subscription System**: Features Standard and Pro tiers with varying daily orb allowances, free weekly/monthly plans, and immediate energy boosts upon purchase. Subscriptions are managed with `active`, `canceled`, and `expired` statuses, with benefits remaining until the end of the current period.

## External Dependencies
- **Telegram Integration**: `@twa-dev/sdk` for Mini App functionality.
- **Blockchain/Payment**: TON Connect UI React (`@tonconnect/ui-react`), TON API for transactions and price fetching.
- **AI Services**: OpenAI API (GPT-5) for astrological interpretations.
- **Database**: PostgreSQL via Neon serverless with Drizzle ORM.
- **Environment Variables**:
    - Core: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `SESSION_SECRET`
    - AI: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`
    - TON: `TON_PRICE_FALLBACK_USD_PER_TON`, `TON_WALLET_ADDRESS`
    - Telegram: `VITE_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`
    - Auth: `ALLOW_TEST_AUTH`, `LOGIN_ALLOWED_SKEW_SECONDS`

## Recent Bug Fixes

### TON Payment Verification Error (Fixed - Oct 16, 2025)
**Problem**: "Transaction not found on blockchain" error when verifying TON payments due to two issues:
1. Backend was searching for incoming transactions TO our wallet instead of searching user's wallet for outgoing transactions
2. Address format mismatch: TON Connect returns user-friendly format (EQ.../UQ...) but TON API returns raw format (0:...)

**Solution**: 
- **Search Direction Fix**: Changed from `findRecentTransaction` (searches our wallet) to `findUserTransaction` (searches user's wallet) in `/api/payments/ton/confirm`
- **Address Normalization**: Added `normalizeTonAddress()` helper using `@ton/core` to convert all addresses to canonical raw format (0:...)
  - Normalizes `userWalletAddress` at payment creation before saving to database
  - Normalizes both recipient (our wallet) and destination (from TON API) addresses before comparison in `findUserTransaction`
- **Validation**: Added checks to ensure `payment.userWalletAddress` exists and wallet address is available before creating payment
- **Frontend**: Added wallet address validation to prevent payment creation when `wallet?.account?.address` is undefined

**Files**: `server/routes.ts`, `server/lib/ton.ts`, `client/src/pages/BuyEnergy.tsx`

### Compatibility Date Auto-Population (Fixed - Oct 16, 2025)
**Problem**: Birth date field remained empty when clicking saved guest charts to auto-fill compatibility form.

**Solution**: Changed from `new Date().toISOString()` (which caused timezone shifts) to simple string split: `chart.birthdayDate.split('T')[0]` to extract YYYY-MM-DD from ISO datetime. Added null/empty guard.

**File**: `client/src/pages/Compatibility.tsx`

### TypeScript Errors in Subscribe.tsx (Fixed - Oct 16, 2025)
**Problem**: Property access errors on empty object types `{}` for useQuery hooks.

**Solution**: Added `UserMeResponse` and `PricesResponse` interfaces matching backend contracts. Applied proper generic type parameters to both useQuery hooks.

**Files**: `client/src/pages/Subscribe.tsx`

### Solar Return Incomplete Localization (Fixed - Oct 16, 2025)
**Problem**: Mixed Russian/English text in Solar Return UI - hardcoded English insights and mixed-language AI prompt.

**Solution**: 
- Added locale-based insight arrays in `server/routes.ts` (lines 813-822)
- Fully translated `server/lib/prompts/solar.md` to Russian
- Added translations for insights to `client/src/lib/translations.ts`

**Files**: `server/routes.ts`, `server/lib/prompts/solar.md`, `client/src/lib/translations.ts`