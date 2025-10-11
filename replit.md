# Astro Orb - AI-Powered Astrology Telegram Mini App

## Overview

Astro Orb is a Telegram Mini App that provides AI-powered astrology readings with natal charts, solar returns, horoscopes, and personalized insights. The application features a gamified energy system, TON blockchain payment integration, and referral mechanics. Built as a full-stack TypeScript application with React frontend and Express backend, it leverages OpenAI for astrological interpretations and astronomical calculations for chart generation.

## Recent Changes (October 11, 2025)

**Russian Localization (Complete):**
- Implemented full bilingual support (English/Russian) using LocaleContext and translations.ts
- Language switcher in Settings page allows instant language switching
- All 14 pages fully localized with useTranslation hook
- Zod validation schemas use useMemo with locale-dependent error messages
- Toast notifications and error messages localized
- Form validation messages switch languages dynamically
- Locale persists in localStorage for user preference

**Canvas Chart Rendering Fix:**
- Fixed "string did not match expected pattern" error in ChartCanvas component
- Canvas 2D API does not support CSS variables directly (var(--color))
- Implemented getComputedStyle to retrieve actual CSS color values
- All chart colors now properly computed from theme tokens
- Natal chart visualization renders correctly with theme colors

**Navigation System Updates:**
- Fixed wouter v3 compatibility: All pages now use `const [, navigate] = useLocation()` instead of deprecated `useNavigate()`
- Updated all 11 page components to use correct navigation pattern
- Verified routing works correctly throughout the app

**TON Payment Security:**
- Implemented secure transaction verification using TonAPI account transactions endpoint
- Added transaction hash replay protection to prevent duplicate payment credits
- Validates payment status before processing to prevent double-crediting
- Normalized address handling for both raw (0:...) and friendly (EQ...) formats
- Proper error handling with detailed logging for payment debugging

**Reading Persistence System:**
- Added 4 new database tables for storing astrology readings:
  - `natal_readings`: Natal chart data with planets (JSONB), aspects (JSONB), and AI interpretations
  - `horoscope_readings`: Horoscope forecasts with period and generated content
  - `compatibility_readings`: Compatibility analyses with partner information
  - `ai_questions`: User questions and AI-generated answers
- Updated storage interface with methods to create and retrieve reading history
- All astrology endpoints now persist readings to database
- Added GET endpoints for retrieving reading history:
  - `/api/astrology/natal/history` - Get past natal chart readings
  - `/api/astrology/horoscope/history` - Get horoscope history
  - `/api/astrology/compatibility/history` - Get compatibility readings
  - `/api/astrology/ask/history` - Get AI question history
- Implemented pagination with configurable limits for history retrieval

**Payment History Dashboard:**
- Created `/payment-history` page with transaction tracking
- Displays all user payments with kind, amounts (USD/TON), status, and timestamps
- Status-based color coding (completed/confirmed = default, pending = secondary, failed = destructive)
- Handles both "completed" and "confirmed" payment statuses
- Recognizes both "energy" and "energy_pack" payment kinds
- Blockchain explorer links for confirmed TON transactions
- Empty state and error handling
- Accessible from Dashboard quick actions

**Admin Panel:**
- Added `isAdmin` boolean field to users table
- Created `requireAdmin` middleware for protected admin routes
- Admin API endpoints:
  - `GET /api/admin/stats` - System statistics (users, revenue, subscriptions, payments)
  - `GET /api/admin/users` - List all users
  - `POST /api/admin/users/:userId/energy` - Update user energy (validated 0-1000)
  - `POST /api/admin/users/:userId/subscription` - Manage user subscriptions
- Zod validation for admin operations:
  - Energy: integer between 0-1000
  - Tier: enum ["standard", "pro"]
  - Status: enum ["active", "cancelled", "expired"]
- Admin frontend at `/admin` with:
  - Dashboard showing key metrics
  - User management with energy and subscription editing
  - Dialog-based editing with validation
  - Proper error handling and loading states

**Test Infrastructure:**
- Added `/api/auth/test` endpoint for development testing (NODE_ENV=development only)
- Creates test users without requiring Telegram initData
- Supports referral code testing in development environment
- Updated replit.md with testing documentation and limitations

**Code Quality:**
- All TypeScript compilation errors resolved
- No console errors in production build
- Clean architecture with proper separation of concerns
- Secure payment webhook with transaction verification

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Routing:**
- React 18 with TypeScript using Vite as the build tool
- Client-side routing via wouter (lightweight React Router alternative)
- Component library: shadcn/ui with Radix UI primitives
- Styling: Tailwind CSS with custom design tokens matching Telegram's native aesthetic

**State Management:**
- Zustand for global state (authentication and energy tracking)
- TanStack Query (React Query) for server state management and API caching
- React Hook Form with Zod validation for form handling

**Design System:**
- Dark mode primary with Telegram-adaptive colors
- Custom color palette: cosmic purple/blue theme with mystical aesthetic
- Typography: Inter (primary), Syne (display/headings), JetBrains Mono (data display)
- Reference-based design approach combining Telegram native UI, Duolingo gamification, Co-Star mystical aesthetic, and Notion card navigation

**Key Features:**
- Telegram WebApp SDK integration for native feel
- TON Connect UI for crypto wallet integration
- Canvas-based natal chart visualization
- Energy badge with real-time countdown to reset
- Multi-step registration flow with timezone support

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript
- Development: tsx for hot reload, Production: esbuild bundled
- Custom middleware for request logging and error handling

**Authentication & Security:**
- JWT-based authentication with 30-day expiry
- Telegram InitData validation using HMAC-SHA256
- Custom auth middleware for protected routes
- Bot token verification for Telegram user data integrity

**API Structure:**
- RESTful endpoints under `/api` namespace
- Route groups:
  - `/api/auth` - Telegram authentication
  - `/api/astrology` - Chart calculations and interpretations
  - `/api/payments` - TON blockchain transactions
  - `/api/referral` - Referral system
  - `/api/user` - User profile management

**Astrology Engine:**
- Astronomical calculations using `astronomia` and `astronomy-engine` libraries
- Planetary position calculations via Julian date conversions
- Natal chart generation with zodiac signs and aspects (conjunction, sextile, square, trine, opposition)
- Solar return calculations for daily forecasts
- BaZi (Chinese astrology) support structure

**Business Logic:**
- Energy system with timezone-aware daily resets
- Configurable energy costs per feature (natal: 2, solar: 1, horoscope: 1, compatibility: 2, ask: 1)
- Subscription tiers (Standard: 100 daily energy, Pro: 250 daily energy)
- Referral rewards: 5 energy for referrer on signup, 10 energy on referred user subscription

### Data Storage

**Database:**
- PostgreSQL via Neon serverless with WebSocket connections
- Drizzle ORM for type-safe database queries
- Schema tables:
  - `users` - User profiles with birth data, energy balance, timezone settings
  - `subscriptions` - Tier, status, renewal dates
  - `payments` - Transaction history with TON blockchain hashes
  - `usageLogs` - Feature usage tracking

**Data Models:**
- User timezone awareness for accurate energy reset calculations (dayjs with timezone plugin)
- Referral code generation using nanoid
- Relational data with Drizzle relations (user → subscription, user → referrals, user → payments)

### External Dependencies

**Telegram Integration:**
- Telegram WebApp SDK (`@twa-dev/sdk`) for Mini App functionality
- Bot token authentication via environment variable `TELEGRAM_BOT_TOKEN`
- InitData validation for secure user identification
- Native UI controls (MainButton, BackButton, haptic feedback)

**Blockchain/Payment:**
- TON Connect UI React (`@tonconnect/ui-react`) for wallet connection
- TON API integration for price fetching and transaction verification
- Payment flow: create payment → send TON transaction → verify on-chain → update user balance
- Manifest served at `/.well-known/tonconnect-manifest.json`

**AI Services:**
- OpenAI API via Replit AI Integrations
- Model: GPT-5 (as of August 7, 2025)
- Custom prompts for different astrology reading types:
  - Natal chart interpretation (250-400 words)
  - Solar return guidance (200-300 words)
  - Horoscope forecasts by period (200-300 words)
  - Compatibility analysis (250-400 words)
  - Custom question answering (200-350 words)

**Environment Variables Required:**
- `DATABASE_URL` - Neon PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN` - Bot authentication token
- `JWT_SECRET` - Token signing key (defaults to 'dev_jwt_secret')
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Replit AI proxy URL
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Replit AI proxy key
- `TON_PRICE_FALLBACK_USD_PER_TON` - Fallback price if API fails (default: 7.5)
- `VITE_BOT_USERNAME` - Telegram bot username for referral links
- `TON_WALLET_ADDRESS` - TON wallet address for receiving payments
- `SESSION_SECRET` - Session encryption secret

## Testing

**Telegram Mini App Context:**
- The app is designed to run exclusively as a Telegram Mini App
- Authentication requires valid Telegram initData from the WebApp SDK
- Production testing must be done within Telegram using the bot

**Development Test Endpoint:**
- `POST /api/auth/test` - Test authentication endpoint (development only)
- Creates test users without requiring Telegram initData
- Accepts optional `referralCode` parameter for testing referral system
- Automatically generates unique test user IDs
- Returns JWT token for authenticated API requests

**Testing Limitations:**
- Playwright end-to-end tests cannot simulate Telegram WebApp environment
- TON payment testing requires real wallet connections or manual API calls
- Energy reset timing depends on user timezone (stored in user profile)
- AI interpretations may vary between test runs (non-deterministic)

**Third-Party Libraries:**
- Form validation: react-hook-form + @hookform/resolvers + zod
- Date handling: dayjs with timezone/utc plugins
- Astronomy calculations: astronomia, astronomy-engine
- UI components: Full Radix UI suite (@radix-ui/react-*)
- Utilities: clsx, tailwind-merge, class-variance-authority