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
- **Energy System Architecture**: Dual-field energy system with `freeEnergy` (resets daily) and `purchasedEnergy` (persists until spent). Daily reset only affects free energy, preserving purchased orbs indefinitely.

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

### Energy System Dual-Field Implementation (Fixed - Oct 17, 2025)
**Problem**: Daily energy reset was overwriting ALL energy (including purchased orbs), causing users to lose paid energy. System used single `energy` field that reset to 10 every day.

**Solution**: Implemented dual-field energy system:
- **Database**: Split `energy` field into `freeEnergy` (default 10, resets daily) and `purchasedEnergy` (default 0, persists indefinitely)
- **Migration**: SQL migration transferred existing energy to new fields: if energy ≤ 10 → all to `freeEnergy`, if > 10 → 10 to `freeEnergy`, remainder to `purchasedEnergy`
- **Reset Logic**: `checkAndResetEnergy()` now only resets `freeEnergy`, keeping `purchasedEnergy` intact
- **Deduction Logic**: `deductEnergy()` deducts from `freeEnergy` first, then from `purchasedEnergy` if needed
- **Purchase Logic**: All energy purchases (TON, Stars, subscription bonuses) add to `purchasedEnergy`
- **API**: `/api/energy` returns combined energy `freeEnergy + purchasedEnergy`

**Files**: `shared/schema.ts`, `server/lib/energy.ts`, `server/routes.ts`, `server/storage.ts`

### Geocoding Implementation - Accurate Ascendant Calculations (Fixed - Oct 17, 2025)
**Problem**: ALL natal charts used hardcoded Moscow coordinates (55.7558°N, 37.6173°E) for Ascendant calculation, causing incorrect results for users in other cities. User birthPlace was stored as text but never geocoded.

**Solution**: Implemented comprehensive geocoding system:
- **Local Cities Database**: Created `server/lib/cities.ts` with 150+ cities (Russia, CIS, Europe, Asia, Americas, Australia) and coordinates
- **Geocoding Utility**: Created `server/lib/geocoding.ts` with two-tier system:
  - Primary: Local database search (instant, no API calls)
  - Fallback: Nominatim API (OpenStreetMap) for cities not in database
  - Moscow fallback only if city not found anywhere
- **Implementation**: Updated all natal chart calculation endpoints:
  - `/api/natal/external` - external natal charts
  - `/api/natal/recalculate` - deprecated endpoint
  - `/api/astrology/solar` - solar return calculations
  - `/api/astrology/compatibility` - compatibility charts (both user & partner)
  - `server/lib/natalService.ts` - core natal computation function
- **Result**: Now ALL users get accurate Ascendant, houses, and angles based on their actual birth location

**Files**: `server/lib/cities.ts`, `server/lib/geocoding.ts`, `server/routes.ts`, `server/lib/natalService.ts`

## Recent Features

### Referral Notification System (Added - Oct 17, 2025)
**Feature**: Users now receive visual notifications when someone joins via their referral link and they earn rewards.

**Implementation**:
- **Database**: Added `referralRewards` table to track referral history with `referrerId`, `referredUserId`, `rewardType` (signup/subscription), `energyAmount`, and `createdAt`
- **Referral System**: Updated `applyReferralBonus()` and `handleSubscriptionReferralBonus()` to:
  - Credit rewards to `purchasedEnergy` (preserving dual-field energy system)
  - Create `referralReward` record for each reward event
- **API Enhancement**: `/api/referral/code` now returns:
  - Full list of referrals with user names, reward types, amounts, and timestamps
  - Aggregate statistics: `totalReferrals` and `totalRewards`
- **UI Updates**:
  - **Referral Page**: Displays referral history with statistics showing total referrals and total rewards earned
  - **Dashboard**: Shows notification badge (!) on referral button when new referrals are detected
  - **Notification Logic**: Uses localStorage to track `lastViewedReferrals` timestamp; badge appears when referrals exist newer than last view
- **User Flow**: When user visits referral page, localStorage is updated, clearing the notification badge

**Files**: `shared/schema.ts`, `server/lib/referral.ts`, `server/routes.ts`, `server/storage.ts`, `client/src/pages/Referral.tsx`, `client/src/pages/Dashboard.tsx`