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

## Recent Updates (October 21, 2025)
- **YooKassa Payment Error Handling - CRITICAL BUGFIX**: Fixed variable scoping bug that prevented error cleanup:
  - **Root Cause**: Used `const yookassaPayment` instead of `yookassaPayment =` on line 2582, creating shadowed variable that prevented catch block cleanup
  - **Impact**: Failed payments accumulated as "zombie" records with empty yookassaPaymentId, causing duplicate key constraint violations
  - **Fix Applied**: Changed to proper variable assignment so catch block can delete failed records
  - **Idempotency Protection**: Uses internal payment ID as idempotency key to prevent duplicate payment creation on repeated clicks
  - **Automatic Cleanup**: If YooKassa API fails, the created payment record is now correctly deleted from database
  - **Duplicate Handling**: Gracefully handles duplicate yookassaPaymentId constraints when idempotency returns existing payment
  - **Database Cleanup**: Removed 20 orphaned payment records with empty yookassaPaymentId
  - **Schema Update**: Added unique constraint on `yookassaPaymentId` field matching production database
- **Energy Restoration System**: Fixed daily energy restoration to use `Math.max()` logic - now correctly replenishes to 10 orbs daily (or 100/250 for subscriptions) instead of replacing values.
- **Low Energy Alert**: Added notification banner on Dashboard when user has < 10 orbs, explaining daily restoration and linking to purchase/subscription options.
- **OpenAI Prompts**: All 8 prompt files converted to plain text format (no markdown formatting: **, ###, -, *) for cleaner AI interpretations.