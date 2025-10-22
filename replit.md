# Astro Orb - AI-Powered Astrology Telegram Mini App

## Overview
Astro Orb is an AI-powered Telegram Mini App designed to provide personalized astrology readings such as natal charts, solar returns, and horoscopes. The project integrates a gamified energy system, triple payment methods (TON blockchain + Telegram Stars + ЮKassa ruble payments), and referral mechanics, all within a user-friendly, full-stack TypeScript application with a React frontend and Express backend. Its core mission is to make intricate astrological insights accessible and engaging through AI-driven interpretations. Owner is self-employed (самозанятый) using ЮKassa for Russian ruble payments.

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
- **Authentication**: Dual-mode authentication system:
  - **Mini App Mode**: Automatic authentication via Telegram WebApp SDK (`initData` validation) for users accessing through t.me links (Menu Button "Играть")
  - **Web Mode**: Telegram Login Widget for users accessing via direct HTTPS URL ("Открыть приложение")
  - JWT-based session management for both modes
- **API**: RESTful endpoints for authentication, astrology, payments, referrals, and user management.
- **Astrology Engine**: Python-based Swiss Ephemeris for precise astronomical calculations.
- **AI Integration**: OpenAI (GPT-5) via Replit AI Integrations for astrological interpretations, using custom, compact prompts with gender-based tone personalization and full localization. Includes personalized compatibility readings.
- **Horoscope System**: Offers daily, weekly, and monthly personalized horoscopes integrated with natal chart data for individual predictions.
- **Business Logic**: Gamified energy system with daily resets, configurable feature costs, subscription tiers, and referral rewards. Users can update their profile once every 30 days.
- **Energy System Architecture**: Dual-field energy system with `freeEnergy` (daily reset) and `purchasedEnergy` (persists).

### System Design Choices
- **Data Caching**: Multi-locale caching for natal charts with on-demand locale generation.
- **Payment Systems**: 
  - **TON Blockchain**: Via TON Connect with server-side verification
  - **Telegram Stars**: With webhook security and idempotency checks
  - **ЮKassa (YooKassa)**: Russian ruble payments via bank cards, with webhook IP verification, payment status tracking, and idempotency key protection using internal payment ID to prevent duplicate charges from race conditions. Legal entity info published at `/legal` endpoint for compliance. Receipt email mandatory for самозанятый compliance with 54-ФЗ.
- **Subscription System**: Standard and Pro tiers offering varying daily orb allowances, free weekly/monthly plans, and immediate energy boosts. Subscriptions have `active`, `canceled`, and `expired` statuses.
- **Geocoding**: Accurate Ascendant calculations using a two-tier geocoding system: local cities database fallback to Nominatim API for precise birth location coordinates.
- **Referral System**: Referral rewards credited to `purchasedEnergy`, tracked in a `referralRewards` table, with notifications for new referrals and detailed history/statistics in the UI.
- **Telegram Stars Admin Panel**: Backend components for fetching paginated Telegram Stars transactions using opaque string tokens and calculating total balance. Admin panel on frontend displays balance, transaction history, and withdrawal instructions.
- **Compatibility Archive**: Tab-based interface displaying past compatibility readings with automatic 2-week deletion. Archive includes rating, relationship type, partner info, and full analysis viewing. Full chart data (planets, houses, angles) is passed to AI for complete analysis including Ascendant comparisons.

## External Dependencies
- **Telegram Integration**: `@twa-dev/sdk`
- **Blockchain/Payment**: TON Connect UI React (`@tonconnect/ui-react`), TON API, ЮKassa SDK (`@appigram/yookassa-node`)
- **AI Services**: OpenAI API (GPT-5)
- **Database**: PostgreSQL via Neon serverless with Drizzle ORM
- **Environment Variables**: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `SESSION_SECRET`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `TON_PRICE_FALLBACK_USD_PER_TON`, `TON_WALLET_ADDRESS`, `VITE_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `ALLOW_TEST_AUTH`, `LOGIN_ALLOWED_SKEW_SECONDS`, `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_TEST_MODE`

## Recent Updates (October 22, 2025)
- **City Database Expansion**: Added 60+ Russian cities including Стерлитамак, Набережные Челны, and all regional capitals
- **Manual City Input**: Users can now input any city manually if not found in database - shows "Use [city name]" button when search returns no results
- **Gender Field Label Fix**: Corrected gender field label from "Личная информация" to "Пол" in registration form
- **YooKassa Idempotency System v5 - UUID with State Management**: Complete redesign of idempotency key generation for YooKassa payments:
  - **UUID v4 Idempotency Keys**: Replaced SHA-256 hash-based keys with standard `crypto.randomUUID()` generation
  - **Component State Persistence**: Each payment attempt generates UUID once and stores in React component state
  - **Retry Safety**: Saved UUID is reused for all retries (network timeouts, user re-clicks) to prevent duplicate charges
  - **Clean Slate After Completion**: UUID cleared on success/error, ensuring next payment gets fresh key
  - **Problem Solved**: Old approach (SHA-256 with minuteTimestamp) changed every minute, preventing multiple purchases per day and risking duplicates if response lost
  - **Implementation**: Both `BuyEnergy.tsx` and `Subscribe.tsx` use `useState` for `yookassaIdempotencyKey` with lazy generation inside mutation handler
  - **Standard Practice**: One UUID per transaction attempt - standard approach used by major payment processors
- **YooKassa Duplicate Key Error - Backend Handling**: Robust backend error handling for YooKassa idempotency:
  - **Proactive Lookup**: Check if `yookassaPaymentId` exists in database BEFORE attempting UPDATE
  - **Duplicate Detection**: If existing payment found, delete new duplicate record and return original confirmation URL
  - **Fallback Error Handling**: Comprehensive error logging (code, constraint, message, detail) with full string search for duplicate detection
  - **Database Schema**: `idempotencyKey` field (varchar 255, unique constraint, indexed) in yookassaPayments table
- **Login Flow Fix - Profile Completion Check**: Fixed redirect loop after registration by changing check from `natalInitialized` to `birthPlace !== null`:
  - **Minimal Profile Creation**: First login creates minimal profile with `birthPlace = null` → redirects to `/register`
  - **Complete Profile Check**: All three auth paths (Mini App, Dev, Widget) check `birthPlace !== null && birthPlace !== ''`
  - **No Redirect Loop**: After registration with real `birthPlace`, users access `/dashboard` directly
  - **Dashboard Coachmark**: Dashboard shows "Create Chart" coachmark if `!natalInitialized`
  - **Backend Response**: `/api/auth/telegram` now includes `natalInitialized: !!natalChart` in response
- **Settings Validation Fix - Optional Birth Time**: Fixed birthTime validation to accept empty values:
  - **Refine Pattern**: Changed from `.regex().optional().or(z.literal(''))` to `.refine()` with conditional logic
  - **User-Friendly Error**: Shows "Format: HH:MM (e.g., 14:30)" only when value is non-empty and invalid
  - **No False Errors**: Empty birthTime field passes validation without issues
- **Global 401 Handler - Stale Token Cleanup**: Added automatic auth cleanup for 401 errors:
  - **Problem**: After database recreation, old JWT tokens remain in localStorage but users don't exist in new database
  - **Solution**: Global 401 handler in `queryClient.ts` that clears localStorage and redirects to `/login`
  - **User Experience**: Shows "Session expired" message instead of confusing "User not found" errors
  - **Coverage**: Works for all API requests (queries and mutations) automatically
- **Energy Restoration System**: Fixed daily energy restoration to use `Math.max()` logic - now correctly replenishes to 10 orbs daily (or 100/250 for subscriptions) instead of replacing values.
- **Low Energy Alert**: Added notification banner on Dashboard when user has < 10 orbs, explaining daily restoration and linking to purchase/subscription options.
- **OpenAI Prompts**: All 8 prompt files converted to plain text format (no markdown formatting: **, ###, -, *) for cleaner AI interpretations.
- **Profile Reset Feature**: New "Danger Zone" section in Settings with profile reset functionality:
  - **Backend Endpoint**: `/api/user/reset-profile` clears `birthPlace`, `birthTime`, deletes natal chart, and resets `lastProfileUpdate`
  - **Data Preservation**: Energy balances (`freeEnergy`, `purchasedEnergy`), subscriptions, and payment history remain intact
  - **UI Implementation**: AlertDialog confirmation with localized warnings in both English and Russian
  - **Flow**: After reset → clears auth → redirects to `/register` for fresh profile setup
  - **Use Case**: Allows users to restart registration process without losing purchased energy or subscriptions
- **Dev Mode Auth Fix - Persistent User ID**: Fixed `/api/auth/test` to use consistent `telegramId` from request instead of generating new one each time:
  - **Problem**: Each dev login created new user with timestamp-based ID, preventing profile updates
  - **Solution**: Uses `telegramId` from request body (default '999999999') to find/create user
  - **Benefit**: Dev user persists across sessions, allowing profile reset and re-registration testing
- **Registration Update Logic - Existing Users**: Fixed `/api/auth/telegram` to update profile data for existing users after reset:
  - **Problem**: Existing users with empty `birthPlace` (after reset) weren't updated during re-registration
  - **Solution**: Added logic to update user data if `birthPlace` is null and full profile data provided
  - **Flow**: Reset → `birthPlace = null` → Re-register → Profile data updates correctly
  - **Impact**: Users can now successfully update birth data after profile reset
- **Payment Cancellation Auto-Redirect (October 22, 2025)**: Fixed YooKassa payment cancellation flow:
  - **Problem**: Canceled payments showed "pending" status indefinitely on PaymentSuccess page
  - **Solution**: Added automatic 3-second redirect to `/buy-energy` page when payment is canceled or failed
  - **User Experience**: Success → dashboard (2s delay), Failed/Canceled → /buy-energy (3s delay) with proper status messages
  - **Implementation**: Auto-redirect logic in PaymentSuccess component with status-based countdown timers
- **Unified Payment History (October 22, 2025)**: Merged TON and YooKassa payment records into single history view:
  - **Backend**: `/api/payments/history` endpoint transforms both payment types into unified format with `paymentMethod` discriminator
  - **Display Logic**: Shows method-specific amounts (RUB for YooKassa, TON for blockchain)
  - **Blockchain Link**: "View on Blockchain" link only appears for TON transactions
  - **Payment Method Badges**: Each transaction shows "TON" or "Bank Card" badge with proper styling
  - **Translations**: Added `paymentMethod` and `bankCard` strings to both English and Russian locales
  - **Bug Fix**: Corrected typo in routes.ts (`amountRub` → `amountRUB`) for YooKassa payment data transformation
- **Payment Status Handling Fix (October 22, 2025)**: Separated abandoned payments from legitimate processing:
  - **Problem**: Users who clicked "Exit payment" on YooKassa were stuck on PaymentSuccess page with no redirect, AND legitimate in-flight payments would be incorrectly redirected away
  - **Backend Solution**: Distinguished YooKassa statuses - `waiting_for_capture` → return 'processing', `pending` → return 'abandoned'
  - **Frontend Implementation**: 
    - `processing` status: Shows "Payment is being processed by bank" + "Check Again" button, NO auto-redirect (preserves polling)
    - `abandoned` status: Shows "Payment was not completed" + auto-redirect to /buy-energy after 5 seconds
    - `failed` status: Auto-redirect to /buy-energy after 5 seconds
    - `success` status: Auto-redirect to /dashboard after 2 seconds
  - **User Experience**: Abandoned payments redirect automatically, real processing payments allow user to poll status manually