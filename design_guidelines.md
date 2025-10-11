# Design Guidelines for Astro Orb Telegram Mini App

## Design Approach: Reference-Based (Telegram Native + Mystical Gaming)

**Primary References:**
- **Telegram's Design System**: Native feel with adaptive colors, seamless WebApp integration
- **Duolingo**: Gamification patterns, energy system visualization, progress tracking
- **Co-Star**: Modern astrology aesthetic, data-driven mysticism, clean typography
- **Notion**: Card-based navigation, information hierarchy, gestural interactions

**Design Philosophy**: Modern mystical minimalism — cosmic elegance without esoteric clutter, data-driven insights with emotional resonance, gamification that motivates without overwhelming.

---

## Color System

### Dark Mode Primary (Telegram-Adaptive)
- **Background**: `222 15% 12%` - Deep cosmic blue-black
- **Surface**: `228 18% 18%` - Elevated card surfaces  
- **Surface Bright**: `230 20% 24%` - Interactive elements, highlighted cards
- **Primary Accent**: `265 85% 68%` - Mystical purple for CTAs, energy indicators
- **Secondary Accent**: `195 75% 55%` - Cosmic cyan for highlights, active states
- **Success/Energy**: `142 72% 52%` - Vibrant green for orb count, positive actions
- **Warning**: `38 92% 55%` - Gold for premium features, subscription prompts
- **Text Primary**: `210 20% 98%` - High contrast white
- **Text Secondary**: `215 15% 70%` - Muted lavender-gray
- **Border**: `220 15% 28%` - Subtle separators

### Light Mode (Telegram-Adaptive Fallback)
- **Background**: `240 20% 98%` - Soft off-white
- **Primary**: `265 70% 52%` - Deeper purple for contrast
- **Energy Accent**: `142 60% 42%` - Toned green for readability

---

## Typography

**Font Families:**
- **Primary**: Inter (400, 500, 600, 700) - Clean, modern, excellent for data
- **Display/Headings**: Syne (600, 700) - Geometric mysticism for impact moments
- **Monospace (data)**: JetBrains Mono (400, 500) - Natal chart coordinates, timestamps

**Scale:**
- Hero/Dashboard Title: `text-3xl md:text-4xl font-bold` (Syne)
- Section Headers: `text-xl md:text-2xl font-semibold` (Inter)
- Card Titles: `text-lg font-medium` (Inter)
- Body: `text-base` (Inter)
- Caption/Meta: `text-sm text-secondary` (Inter)
- Energy Badge: `text-2xl font-bold tabular-nums` (JetBrains Mono)

---

## Layout System

**Spacing Primitives**: Tailwind units of `2`, `4`, `6`, `8`, `12`, `16`, `20` (e.g., `p-4`, `gap-6`, `mb-8`)

**Container Strategy:**
- Full-width sections: `w-full px-4 md:px-6`
- Content max-width: `max-w-4xl mx-auto`
- Card grids: `grid gap-4 grid-cols-1 md:grid-cols-2`

**Telegram-Specific:**
- Safe area padding: `pt-[env(safe-area-inset-top)]` and `pb-[env(safe-area-inset-bottom)]`
- MainButton reserve: `pb-20` on last scrollable section
- BackButton integration: No redundant header back buttons

---

## Component Library

### Navigation
**Dashboard Card Grid:**
- 2-column layout on mobile, 2-3 columns on desktop
- Each card: Icon (cosmic glyph) + Feature name + Energy cost badge + Subtle arrow
- Hover/tap: Scale transform `scale-[1.02]`, elevated shadow, border glow
- Disabled state (insufficient energy): Grayscale + opacity 60% + lock icon overlay

**Energy Badge (Persistent Header):**
- Floating pill: Gradient background `from-primary to-secondary`, rounded-full
- Large orb count with pulse animation when gained/spent
- Tap to expand: Shows daily limit, reset countdown, "Buy More" CTA

### Forms & Inputs
**Registration Flow:**
- Step indicators: Progress dots with cosmic trail effect
- Date/Time Pickers: Native Telegram selectors with fallback to custom wheels
- Location Input: Autocomplete with timezone detection, map preview modal
- Validation: Inline micro-feedback, green check on valid, red shake on error

**Astrology Input Cards:**
- Partner compatibility: Floating card with avatar placeholder, compact form
- Free question: Expanding textarea with character count, suggested prompts below

### Data Display
**Natal Chart Visualization:**
- Canvas-based circular chart: 12 houses with zodiac glyphs on outer ring
- Planet positions: Glowing dots with connecting aspect lines (colored by type)
- Legend sidebar: Scrollable list of aspects with strength indicators
- Export button: "Share as image" with branded watermark

**Reading Cards:**
- AI-generated text: Serif font for mystical feel, line-height 1.8
- Key insights: Highlighted teal boxes with icon prefixes
- Interpretation sections: Collapsible accordions with cosmic dividers
- "Ask follow-up" button: Sticky bottom, costs 1 orb

### Payment & Monetization
**Subscription Cards:**
- Side-by-side comparison: Standard vs Pro
- Highlight recommended (Pro): Pulsing border, "Most Popular" badge
- Benefits list: Check icons, emphasized daily orb count (huge number)
- Price display: TON amount large, USD equivalent small beneath
- TonConnect button: Branded gradient, wallet icon, "Pay with TON"

**Energy Pack Modal:**
- Bottom sheet overlay with blur backdrop
- 3 pack options: Stacked cards with best-value highlighted
- Real-time TON price ticker at top
- One-tap purchase flow via TonConnect

**Referral Dashboard:**
- Hero stat: Giant referral count with confetti animation on increase
- Referral link: Copy button with haptic feedback, social share options
- Earnings ledger: Timeline of +5/+10 orb bonuses with avatars
- Incentive prompt: "Invite 3 friends, unlock 30 bonus orbs" progress bar

### Micro-Interactions
- Orb spend: Subtle particle burst from energy badge to used feature
- Chart calculation: Orbital loading animation (planets orbiting)
- Payment success: Full-screen confetti + orb rain + success chime
- Daily reset: Gentle notification with sunrise gradient overlay
- Telegram haptics: Light tap on buttons, medium on important actions, heavy on errors

---

## Images

**Hero/Empty States:**
- **Dashboard Hero**: Cosmic orb visualization (translucent sphere with inner glow, floating particles) - abstract, not literal astrology symbols - placed behind semi-transparent energy badge
- **Feature Illustrations**: Minimalist line-art constellations for each astrology feature card (natal=circular mandala, solar=sun rays, compatibility=intertwined orbits)
- **Empty State**: When no readings yet - centered illustration of telescope gazing at stars with "Begin your cosmic journey" text
- **Subscription Promo**: Abstract nebula gradient background for plan comparison cards

**Placement:**
- Dashboard: 40vh cosmic orb background (fixed position, subtle parallax)
- Feature cards: 64x64px icon illustrations, top-left of card
- Loading states: 120x120px animated orb (pulsing gradient)
- No large hero image - Telegram Mini Apps favor immediate utility

---

## Accessibility & Telegram Integration

- **Telegram Theme Sync**: Respect `telegram.themeParams`, override only accent colors
- **MainButton Usage**: Primary CTAs (Subscribe, Buy Energy, Generate Chart) trigger Telegram's native bottom button
- **BackButton**: Auto-shows on nested screens, hides on dashboard root
- **Haptic Feedback**: `telegram.HapticFeedback` on all button taps, intensity varies by action weight
- **Dark Mode Default**: Optimized for OLED screens, pure blacks for energy efficiency
- **Text Contrast**: WCAG AAA on all body text, AA on decorative elements
- **Touch Targets**: Minimum 44x44px, generous card padding (p-4 minimum)

---

## Animation Budget

**Strategic Use Only:**
- Energy gain/loss: 0.3s particle effects
- Chart rendering: 0.6s fade-in with stagger
- Payment success: 1.2s celebration (one-time per session)
- Navigation: 0.2s slide transitions between routes
- **No animations**: Card hovers, scrolling, typing indicators (Telegram handles these)

---

**Quality Mandate**: Every screen must feel purposeful and complete. The dashboard is the product's face - make it irresistibly tappable with clear value props on each card. Gamification should delight, not frustrate - always show path to more energy. Mystical aesthetics must serve clarity, never obscure functionality.