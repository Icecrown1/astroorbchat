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
- **Business Logic**: Tier-based orb system with monthly resets, configurable feature costs, subscription tiers, and referral rewards. Users can update their profile every 30 days.
- **Monetization System** (February 2026):
  - **Subscription Tiers**:
    - **Free**: Basic natal chart with short planet descriptions only. No orbs. All features grayed out and non-clickable.
    - **Standard** (199₽/mo): 250 stars/month. All features except Solar Return.
    - **Premium** (399₽/mo): 550 stars/month. All features including Solar Return.
  - **Star Costs** (ORB_COSTS in energy.ts):
    - Oracle: 0.5 stars
    - Daily horoscope: 1 star
    - Planet/House interpretation: 2 stars
    - Important dates: 3 stars
    - Weekly horoscope: 5 stars
    - Monthly horoscope: 15 stars
    - Solar Return: 15 stars (Premium only)
    - Guest charts/Compatibility: 20 stars
  - **Premium-Only Features**: Solar Return (`PREMIUM_ONLY_FEATURES` in energy.ts)
  - **Subscription Prices** (RUB):
    - Standard: 199/mo, 159/mo (6-month), 99/mo (annual)
    - Premium: 399/mo, 359/mo (6-month), 179/mo (annual)
  - **Monthly Star Reset**: Standard gets 250, Premium gets 550 stars on the 1st of each month
  - **Database Fields**: `subscriptionOrbs`, `referralOrbs`, `orbsResetAt` in users table
  - **UI Terminology**: "Stars" (EN) / "Звёзды" (RU) — internal code still uses "orbs" for variable names
- **Referral System** (Tier-based rewards, February 2026):
  - Rewards triggered when invited friend PAYS for subscription
  - **Free users**: Referrer gets 7 days Standard + 3 days Premium
  - **Standard users**: Referrer gets +10 stars + subscription extension (3 days)
  - **Premium users**: Referrer gets +20 stars + subscription extension (3 days)
  - Rewards tracked in `referralRewards` table with `rewardKind` (orbs/subscription_days) and `subscriptionDays` fields

### System Design Choices
- **Data Caching**: 
  - **Natal Chart Interpretations**: AI-generated interpretations cached by locale in `professionalInterpretation` field (October 22, 2025)
    - Structure: `{ "ru": "...", "en": "..." }` for multi-locale support
    - First request per locale generates via OpenAI and saves to database
    - Subsequent requests retrieve from cache instantly (0 OpenAI calls)
    - Cache automatically invalidated when user profile changes (birth data/time/place)
    - Significantly improves performance and reduces OpenAI API costs
  - **Astronomical Calculations**: Natal chart positions (planets, houses, aspects) cached in database
  - **Solar Return Caching** (October 23, 2025):
    - **Astronomically Accurate Calculation**: Uses Swiss Ephemeris to find exact moment when Sun returns to natal position
    - **Algorithm**: Finds precise time (year, month, day, hour, minute) when transiting Sun longitude equals natal Sun longitude
    - Solar Return can occur 1-2 days before/after birthday due to astronomical variations
    - **natal_sun_longitude**: Stored in natalCharts table upon first natal chart calculation for reuse
    - **Location-Aware Caching**: Cached by (userId, targetYear, location) to support different cities for same year
    - Location is normalized (trim + toLowerCase) for consistent cache matching
    - Cost: 15 orbs (increased from 11 orbs)
    - Subscribers get solar returns free; cached results don't deduct energy on subsequent views
    - Requires complete natal chart (with birth time and place); returns 409 if missing
    - Energy deducted AFTER successful calculation to prevent charging for failed requests
    - Frontend shows subscription-aware messaging and cached result indicators
    - User can select target year (current + 3 future years) and specify where they'll be on birthday
- **Payment Systems**:
  - **TON Blockchain**: Via TON Connect with server-side verification.
  - **Telegram Stars**: With webhook security and idempotency checks.
  - **ЮKassa (YooKassa)**: Russian ruble payments with webhook IP verification, payment status tracking, and UUID-based idempotency. Includes legal compliance for self-employed individuals (самозанятый).
- **Dynamic Exchange Rates** (November 26, 2025):
  - **USD/RUB**: Daily rate from Central Bank of Russia (ЦБ РФ) API: `https://www.cbr-xml-daily.ru/daily_json.js`
  - **TON/USD**: Real-time rate from CoinGecko API, cached 5 minutes
  - Backend service: `server/lib/exchangeRates.ts`
  - API endpoint: `GET /api/exchange-rates` (public, no auth)
  - Cron endpoint: `POST /api/cron/update-exchange-rates` for daily CBR refresh
  - Frontend displays current rates with refresh button on BuyEnergy and Subscribe pages
  - Fallback rates: USD/RUB = 78.50, TON/USD = 5.50
- **Subscription System**: 
  - Standard and Pro tiers with varying orb allowances, free plans, and energy boosts
  - Multi-period options: Monthly, 6-month (-10%), Annual (-25%) with auto-renewal
  - **Auto-Renewal System** (November 26, 2025):
    - Works only with YooKassa ruble payments
    - User can enable via checkbox on Subscribe page
    - Uses `save_payment_method: true` to store payment method
    - Payment method ID saved in subscription `paymentMethodId` field
    - Subscription fields: `autoRenew`, `periodMonths`, `paymentMethodId`
    - Cron job `/api/cron/process-renewals` handles daily processing:
      - Processes renewals 1 day before expiration
      - Sends 3-day advance warnings via Telegram
    - Library: `server/lib/subscriptionRenewal.ts` for renewal logic
- **Geocoding**: Two-tier system: local cities database fallback to Nominatim API.
- **Referral System**: Tier-based rewards (see Monetization System above), tracked in `referralRewards` table with UI for history and statistics.
- **Telegram Stars Admin Panel**: Backend and frontend components for transaction history, balance, and withdrawal instructions.
- **Compatibility Archive**: Tab-based interface for past compatibility readings with auto-deletion, including full chart data for AI analysis.
- **Global Error Handling**: Automatic cleanup of stale authentication tokens on 401 errors.
- **Profile Management**: Feature to reset profile data while preserving energy and subscriptions.
- **Payment Flow Fixes**: Enhanced YooKassa idempotency with UUIDs, robust backend duplicate key handling, and improved payment cancellation/abandonment redirects. Fixed TON Mini App URL handling for continuous blockchain polling.
- **Important Dates System** (October 22, 2025):
  - **Lunar Phases**: Automatic calculation of new moons and full moons with exact dates and zodiac signs
  - **Planet Transits**: Tracking when planets change zodiac signs with precision timing
  - **Personalized Houses**: Events mapped to user's houses based on Sun sign (Whole Sign Houses system)
  - **Expanded Importance Criteria**: Events marked as high importance based on multiple factors:
    - Events in user's Sun sign (personal activation)
    - Events in user's Ascendant sign (identity/life path)
    - Events in 1st house from Ascendant (self/personality)
    - Events in 7th house from Ascendant (relationships/partnerships)
    - Events in 10th house from Ascendant (career/public status)
  - **Clickable Events**: Each event opens modal with AI-generated personalized interpretation (costs 2 orbs)
  - **Python Swiss Ephemeris Integration**: `important_dates_api.py` calculates astronomical events with high accuracy
- **Instagram Lead Magnet** (December 5, 2025):
  - **Public Landing Page**: `/lead` page for collecting user data without authentication
  - **Database Table**: `leads` table stores collected data with conversion tracking
  - **Free Personalized Horoscope**: Uses same natal chart + horoscope pipeline (Swiss Ephemeris + OpenAI)
  - **Flow**: User fills form → AI calculates horoscope → Shows result → Deep-link to Telegram bot
  - **Deep-Link Integration**: Format `t.me/botname?start=lead_xxx` transfers lead ID to Mini App
  - **Registration Pre-fill**: Mini App detects lead ID from startParam, fetches lead data, pre-fills registration form
  - **Conversion Tracking**: Lead marked as converted after successful registration
  - **Security**: Returns minimal PII, validates lead ID format, handles 404/410 gracefully
  - **API Endpoints**: `POST /api/lead/calculate`, `GET /api/lead/:id`, `POST /api/lead/:id/convert`

## External Dependencies
- **Telegram Integration**: `@twa-dev/sdk`
- **Blockchain/Payment**: `@tonconnect/ui-react`, TON API, `@appigram/yookassa-node`
- **AI Services**: OpenAI API (GPT-5)
- **Database**: PostgreSQL via Neon serverless with Drizzle ORM
- **Environment Variables**: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `SESSION_SECRET`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `TON_PRICE_FALLBACK_USD_PER_TON`, `TON_WALLET_ADDRESS`, `VITE_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `ALLOW_TEST_AUTH`, `LOGIN_ALLOWED_SKEW_SECONDS`, `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_TEST_MODE`