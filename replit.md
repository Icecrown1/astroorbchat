# Astro Orb - AI-Powered Astrology Telegram Mini App

## Overview
Astro Orb is an AI-powered Telegram Mini App that provides astrology readings including natal charts, solar returns, horoscopes, and personalized insights. It features a gamified energy system, TON blockchain payment integration, and referral mechanics. The project aims to deliver accurate astrological interpretations using OpenAI and precise astronomical calculations, all within a user-friendly, full-stack TypeScript application with a React frontend and Express backend.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Frameworks**: React 18, TypeScript, Vite, wouter for routing.
- **UI/UX**: shadcn/ui with Radix UI, Tailwind CSS for styling, dark mode with custom cosmic theme, Telegram native UI aesthetics.
- **State Management**: Zustand for global state, TanStack Query for server state, React Hook Form with Zod for forms.
- **Key Features**: Telegram WebApp SDK integration, TON Connect UI, canvas-based natal chart visualization, real-time energy countdown, multi-step registration.

### Backend
- **Server**: Express.js with TypeScript.
- **Authentication**: JWT-based with Telegram InitData validation (HMAC-SHA256).
- **API**: RESTful endpoints for authentication, astrology, payments, referrals, and user management.
- **Astrology Engine**: Utilizes Swiss Ephemeris via a Python bridge for accurate astronomical calculations (natal charts, solar returns, horoscopes, compatibility).
- **Business Logic**: Gamified energy system with daily resets, configurable feature costs, subscription tiers, and referral rewards.
- **AI Integration**: OpenAI (GPT-5) via Replit AI Integrations for astrological interpretations, with custom prompts for various reading types and gender-based tone personalization.
  - **GPT-5 Optimization**: Compact prompt system reduces size by 90% to prevent reasoning token exhaustion. Uses helper functions (`extractKeyPlanetPositions`, `summarizeTransits`) instead of full JSON.
  - **Prompt Helpers**: `findHouseForPlanet` calculates house positions, `extractKeyPlanetPositions` creates compact planet summaries, `summarizeTransits` preserves all transit data in concise format.
  - **Full Localization**: All prompts (labels, planets, aspects) fully localized for ru/en. Planet translations (Sun→Солнце), aspect translations (square→квадрат).
  - **Token Limits**: `max_completion_tokens=5000` for weekly/monthly plans balances quality and cost.
- **Personalized Compatibility**: All compatibility interpretations use real user names (e.g., "Марина и Алексей" / "Marina and Alex") throughout the analysis. The AI prompts enforce name usage (minimum 1 name per section), and backend validates that names appear in the response. This personalization increases engagement and makes readings feel individually crafted.
- **Data Caching**: Multi-locale caching for natal charts (`{ru: {...}, en: {...}}`), automatic locale generation on-demand.
- **Horoscope System**: 
  - **Daily Horoscope**: Three time periods (Morning/Day/Evening) with five life themes (Money/Work/Study/Love/Health). Evening includes self-care recommendations. Deeply personalized using natal chart data (planets in houses, aspects, stelliums).
  - **Weekly Plan**: Structured by weekdays (Mon-Sun) with 5 themes per day. Always calculates from Monday to Sunday of current week, even if requested mid-week. Free for subscribers, 1 orb for others.
  - **Monthly Plan**: Full month coverage with week-by-week breakdown. Always spans entire month (1st to last day). Free for subscribers, 1 orb for others.
  - **Date Storage**: All horoscopes saved with `startDate` and `endDate` fields for proper period tracking.
  - **Personalization**: All forecasts use natal chart analysis (house rulers, planetary positions, aspects) for individual predictions, not generic readings.

### Data Storage
- **Database**: PostgreSQL via Neon serverless with Drizzle ORM.
- **Schema**: Tables for `users`, `subscriptions`, `payments`, `usageLogs`, `natal_readings`, `horoscope_readings`, `compatibility_readings`, `ai_questions`, `importantDateUnlocks`, `externalNatals`, `starPayments`.
- **Energy Costs**: Basic natal chart and horoscope readings cost 1 orb each, compatibility analysis costs 2 orbs. Energy resets daily to 10 orbs.
- **Profile Update Restriction**: Users can only update their profile (name, gender, age, birth data) once per 30 days via `lastProfileUpdate` timestamp check in `/api/user/update`. Returns error with days remaining if attempted too soon. Profile updates DO NOT affect existing subscriptions.

### Payment Systems
- **TON Blockchain**: Cryptocurrency payments via TON Connect wallet integration with blockchain verification
  - **TON Connect Setup**: Uses `@tonconnect/ui-react` Provider with manifest at `/.well-known/tonconnect-manifest.json`
  - **Wallet Integration**: `useTonConnectUI()` hook provides wallet connection state and transaction methods
  - **Payment Flow**: Create pending payment → Send TON transaction → Backend polls TON API → Finds transaction by amount+time → Verifies & credits energy
  - **Verification Method**: Uses `findRecentTransaction()` to poll TON API (tonapi.io) for incoming transactions matching exact amount within 10-minute window
  - **Security Features**:
    - Blockchain verification via TON API (amount + timestamp matching)
    - txHash uniqueness check (prevents replay attacks)
    - User ownership validation (payment.userId === userId)
    - 10-minute expiry window for transaction matching
    - Idempotency support (safe to retry confirmation)
- **Telegram Stars**: In-app purchases using Telegram's native Stars currency (⭐)
  - **Version Requirement**: Requires Telegram WebApp version 6.1+ (method `openInvoice` not available in 6.0)
  - **Version Check**: Frontend validates Telegram version before allowing Stars payments, shows warning for outdated versions
  - **Pricing**: 20 orbs = 190 Stars, 50 orbs = 375 Stars, 120 orbs = 750 Stars (~62.5 Stars per USD)
  - **Security Features**:
    - Server-side price validation (prevents client-side tampering)
    - Webhook secret token authentication (optional, via TELEGRAM_WEBHOOK_SECRET)
    - Idempotency checks (prevents duplicate energy crediting)
    - Race condition protection (atomic status updates using `isNull()` for NULL checks)
    - Amount verification (ensures paid amount matches expected)
  - **Payment Flow**: Invoice creation → WebApp.openInvoice() → pre_checkout_query (validation) → successful_payment (fulfillment) → energy crediting
  - **Refund Support**: telegram_payment_charge_id stored for refund capability

### Subscription System
- **Tiers**: Standard ($9/month, 100 daily orbs) and Pro ($15/month, 250 daily orbs)
- **Benefits**: 
  - **Standard Tier**: 100 daily orbs, free weekly plan, free monthly plan, basic support
  - **Pro Tier**: 250 daily orbs, free weekly plan, free monthly plan, priority processing, premium support
  - **Immediate Energy**: Upon purchase, users instantly receive 100 orbs (Standard) or 250 orbs (Pro) - adds to existing balance
  - **Daily Energy**: 100 orbs (Standard) or 250 orbs (Pro) automatically credited each day at reset (overwrites to tier amount)
  - Benefits active for both 'active' and 'canceled' statuses until currentPeriodEnd
- **Payment**: TON blockchain only (same flow as energy packs)
- **Expiration Logic**:
  - `checkSubscriptionExpiry()` helper checks if currentPeriodEnd has passed
  - Automatically updates status from 'active'/'canceled' → 'expired' when period ends
  - Called BEFORE checking subscription benefits (weekly/monthly plans) to prevent post-expiry access
  - Also checked during daily energy reset in `checkAndResetEnergy()`
- **Cancellation**:
  - Users can cancel via `/api/user/subscription/cancel` endpoint
  - Status changes to 'canceled' but benefits remain until currentPeriodEnd
  - After period ends, status automatically becomes 'expired'
- **Status Flow**: active → (user cancels) → canceled → (period ends) → expired
- **UI**: 
  - Subscribe.tsx shows status cards (active/canceled/expired), cancel button for active subs, days remaining
  - Weekly/Monthly Plan modals show "✨ БЕСПЛАТНО для подписчиков" / "✨ FREE for subscribers" for users with 'active' or 'canceled' status
  - PaymentHistory.tsx includes back button for easy navigation to dashboard
- **Dev Mode**: In development, "Dev: Free Subscribe" button activates subscription instantly without payment
  - Backend: `/api/dev/subscribe` endpoint (only works when NODE_ENV=development)
  - Frontend: Button visible only when import.meta.env.DEV is true
  - Security: Production-safe (disabled in production builds)

## External Dependencies
- **Telegram Integration**: `@twa-dev/sdk` for Mini App functionality and UI controls.
- **Blockchain/Payment**: TON Connect UI React (`@tonconnect/ui-react`) for wallet connection, TON API for transactions and price fetching.
- **AI Services**: OpenAI API (GPT-5) for astrological interpretations.
- **Environment Variables**: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `TON_PRICE_FALLBACK_USD_PER_TON`, `VITE_BOT_USERNAME`, `TON_WALLET_ADDRESS`, `SESSION_SECRET`, `TELEGRAM_WEBHOOK_SECRET` (optional, for Stars webhook security).