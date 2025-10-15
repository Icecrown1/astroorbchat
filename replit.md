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
- **Schema**: Tables for `users`, `subscriptions`, `payments`, `usageLogs`, `natal_readings`, `horoscope_readings`, `compatibility_readings`, `ai_questions`, `importantDateUnlocks`, `externalNatals`.
- **Energy Costs**: Basic natal chart and horoscope readings cost 1 orb each, compatibility analysis costs 2 orbs. Energy resets daily to 10 orbs.

## External Dependencies
- **Telegram Integration**: `@twa-dev/sdk` for Mini App functionality and UI controls.
- **Blockchain/Payment**: TON Connect UI React (`@tonconnect/ui-react`) for wallet connection, TON API for transactions and price fetching.
- **AI Services**: OpenAI API (GPT-5) for astrological interpretations.
- **Environment Variables**: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `TON_PRICE_FALLBACK_USD_PER_TON`, `VITE_BOT_USERNAME`, `TON_WALLET_ADDRESS`, `SESSION_SECRET`.