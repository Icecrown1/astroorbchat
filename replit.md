# Astro Orb - AI-Powered Astrology Telegram Mini App

## Overview
Astro Orb is an AI-powered Telegram Mini App designed to provide personalized astrology readings such as natal charts, solar returns, and horoscopes. The project integrates a gamified energy system, TON blockchain payments, and referral mechanics, all within a user-friendly, full-stack TypeScript application with a React frontend and Express backend. Its core mission is to make intricate astrological insights accessible and engaging through AI-driven interpretations.

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
- **Payment Systems**: TON Blockchain (via TON Connect) with server-side verification, and Telegram Stars with webhook security and idempotency checks.
- **Subscription System**: Standard and Pro tiers offering varying daily orb allowances, free weekly/monthly plans, and immediate energy boosts. Subscriptions have `active`, `canceled`, and `expired` statuses.
- **Geocoding**: Accurate Ascendant calculations using a two-tier geocoding system: local cities database fallback to Nominatim API for precise birth location coordinates.
- **Referral System**: Referral rewards credited to `purchasedEnergy`, tracked in a `referralRewards` table, with notifications for new referrals and detailed history/statistics in the UI.
- **Telegram Stars Admin Panel**: Backend components for fetching paginated Telegram Stars transactions using opaque string tokens and calculating total balance. Admin panel on frontend displays balance, transaction history, and withdrawal instructions.
- **Compatibility Archive**: Tab-based interface displaying past compatibility readings with automatic 2-week deletion. Archive includes rating, relationship type, partner info, and full analysis viewing. Full chart data (planets, houses, angles) is passed to AI for complete analysis including Ascendant comparisons.

## External Dependencies
- **Telegram Integration**: `@twa-dev/sdk`
- **Blockchain/Payment**: TON Connect UI React (`@tonconnect/ui-react`), TON API
- **AI Services**: OpenAI API (GPT-5)
- **Database**: PostgreSQL via Neon serverless with Drizzle ORM
- **Environment Variables**: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `SESSION_SECRET`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `TON_PRICE_FALLBACK_USD_PER_TON`, `TON_WALLET_ADDRESS`, `VITE_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `ALLOW_TEST_AUTH`, `LOGIN_ALLOWED_SKEW_SECONDS`