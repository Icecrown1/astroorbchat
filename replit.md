# Astro Orb - AI-Powered Astrology Telegram Mini App

## Overview
Astro Orb is an AI-powered Telegram Mini App providing personalized astrology readings (natal charts, solar returns, horoscopes) through AI-driven interpretations. It features a gamified energy system, triple payment methods (TON blockchain, Telegram Stars, ЮKassa), and referral mechanics. The project's ambition is to make complex astrological insights accessible and engaging within a full-stack TypeScript application with a React frontend and Express backend.

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
- **Authentication**: Dual-mode authentication (Mini App via Telegram WebApp SDK, Web via Telegram Login Widget) with JWT-based session management.
- **API**: RESTful endpoints for core functionalities.
- **Astrology Engine**: Python-based Swiss Ephemeris for astronomical calculations.
- **AI Integration**: OpenAI (GPT-5) for astrological interpretations, using custom prompts with gender-based tone and full localization. Includes personalized compatibility readings and horoscopes.
- **Business Logic**: Gamified energy system with daily resets, configurable feature costs, subscription tiers, and referral rewards. Users can update their profile every 30 days.
- **Energy System Architecture**: Dual-field energy system with `freeEnergy` (daily reset) and `purchasedEnergy` (persists).

### System Design Choices
- **Data Caching**: Multi-locale caching for natal charts.
- **Payment Systems**:
  - **TON Blockchain**: Via TON Connect with server-side verification.
  - **Telegram Stars**: With webhook security and idempotency checks.
  - **ЮKassa (YooKassa)**: Russian ruble payments with webhook IP verification, payment status tracking, and UUID-based idempotency. Includes legal compliance for self-employed individuals (самозанятый).
- **Subscription System**: Standard and Pro tiers with varying orb allowances, free plans, and energy boosts.
- **Geocoding**: Two-tier system: local cities database fallback to Nominatim API.
- **Referral System**: Rewards credited to `purchasedEnergy`, tracked in `referralRewards` table, with UI for history and statistics.
- **Telegram Stars Admin Panel**: Backend and frontend components for transaction history, balance, and withdrawal instructions.
- **Compatibility Archive**: Tab-based interface for past compatibility readings with auto-deletion, including full chart data for AI analysis.
- **Global Error Handling**: Automatic cleanup of stale authentication tokens on 401 errors.
- **Profile Management**: Feature to reset profile data while preserving energy and subscriptions.
- **Payment Flow Fixes**: Enhanced YooKassa idempotency with UUIDs, robust backend duplicate key handling, and improved payment cancellation/abandonment redirects. Fixed TON Mini App URL handling for continuous blockchain polling.

## External Dependencies
- **Telegram Integration**: `@twa-dev/sdk`
- **Blockchain/Payment**: `@tonconnect/ui-react`, TON API, `@appigram/yookassa-node`
- **AI Services**: OpenAI API (GPT-5)
- **Database**: PostgreSQL via Neon serverless with Drizzle ORM
- **Environment Variables**: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `SESSION_SECRET`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `TON_PRICE_FALLBACK_USD_PER_TON`, `TON_WALLET_ADDRESS`, `VITE_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `ALLOW_TEST_AUTH`, `LOGIN_ALLOWED_SKEW_SECONDS`, `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_TEST_MODE`