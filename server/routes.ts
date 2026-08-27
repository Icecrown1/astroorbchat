import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage";
import { db } from "./db";
import { calcMatrixFromISO, MATRIX_SECTIONS, FREE_MATRIX_SECTIONS, sectionArcana } from "../shared/matrix";
import { requireAuth, requireAdmin } from "./middleware/auth";
import { validateTelegramInitData, parseTelegramInitData } from "./lib/telegram";
import { generateToken } from "./lib/jwt";
import { generateReferralCode, applyReferralBonus, handleSubscriptionReferralBonus, claimReferralChoice } from "./lib/referral";
import { 
  checkAndResetEnergy, 
  checkSubscriptionExpiry, 
  deductEnergy, 
  getNextResetTime, 
  ENERGY_COSTS,
  ORB_COSTS,
  canAccessFeature,
  deductOrbs,
  getUserTier,
  checkAndResetOrbs,
  creditPurchasedOrbs,
} from "./lib/energy";
import { getTonPrice, convertUSDToTON, verifyTonTransaction, findRecentTransaction, findUserTransaction, normalizeTonAddress } from "./lib/ton";
import { calculateNatalChart, calculateSolarReturn, calculateBaZi } from "./lib/astrology";
import { getAstrologyInterpretation, getPlanetInterpretation, getHouseInfluence, interpretImportantDate, interpretHoroscope, generateWeeklyPlan, generateMonthlyPlan, getImportantDateInterpretation, type PlanetInterpretationData, type HouseInfluenceData, type ImportantDateInterpretationInput } from "./lib/openai";
import { calculateNatalChartPython, calculateSolarReturnTime, calculateTransits, mapTransitsToNatalHouses, type NatalChartResult } from "./lib/pythonNatal";
import { ensureUserNatalChart, computeNatalFromUser, recomputeIfProfileChanged, ensureNatalInterpretation } from "./lib/natalService";
import { findImportantEvents, extractNatalPlanets, getImportantDatesWithLunarPhases } from "./lib/transits";
import { geocodeCityWithFallback, getTimezoneFromCity } from "./lib/geocoding";
import { searchCities } from "./lib/cities";
import { handleTelegramLoginWidget } from "./lib/tgLoginVerify";
import { createPayment as createYooKassaPayment, getPayment as getYooKassaPayment, checkPaymentStatus, verifyWebhookIP, parseWebhookPayload } from "./lib/yookassa";
import { activateSucceededYookassaPayment, reconcileYookassaPayment, activateSubscriptionForUser } from "./lib/paymentActivation";
import { sendSupportAlert } from "./lib/support";
import { getAllExchangeRates, forceRefreshAllRates, getCacheStatus } from "./lib/exchangeRates";
import { nanoid } from "nanoid";
import { z } from "zod";
import dayjs from 'dayjs';
import { ORB_PACKS, getOrbPack, getOrbPackByOrbs } from "@shared/orbPacks";
import { SUBSCRIPTION_PRICES_PER_MONTH, PERIOD_LABEL_RU, STARS_SUB_PRICES, subscriptionRub, upgradeRub, starsForRub, normalizePaidTier, type PeriodMonths } from "@shared/subscriptionPrices";
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

interface StoredNatalChart extends NatalChartResult {
  interpretation?: string;
}

// Server start time for build date tracking
const SERVER_START_TIME = new Date().toISOString();

export async function registerRoutes(app: Express): Promise<Server> {
  // Version endpoint (public - no auth required)
  app.get("/api/version", (req, res) => {
    res.json({
      ok: true,
      data: {
        version: "1.0.0",
        gitCommit: "e2b66b8",
        buildDate: SERVER_START_TIME,
      }
    });
  });

  app.post("/api/auth/telegram", async (req, res) => {
    try {
      const { initData, name, gender, birthdayDate, birthTime, birthPlace } = req.body;
      const timezone = birthPlace ? await getTimezoneFromCity(birthPlace) : "Europe/Moscow";

      // Web attribution: start_param like web_{page}_{cta} forwarded by the client
      const signupSource = (typeof req.body.signupSource === 'string' && /^web_[a-z0-9_-]{1,60}$/i.test(req.body.signupSource))
        ? req.body.signupSource.slice(0, 64)
        : null;

      // Check if test auth is allowed (dev workspace или явный флаг; прод — только с initData)
      const allowTestAuth = process.env.ALLOW_TEST_AUTH === 'true' || process.env.NODE_ENV === 'development';
      const hasInitData = initData && initData.length > 0;

      if (!hasInitData && !allowTestAuth) {
        return res.status(401).json({ ok: false, error: "Invalid Telegram data: initData required" });
      }

      if (hasInitData && !validateTelegramInitData(initData)) {
        return res.status(401).json({ ok: false, error: "Invalid Telegram data: validation failed" });
      }

      // Parse Telegram user or create fake user for test mode
      let tgUser = hasInitData ? parseTelegramInitData(initData) : null;
      
      // If no initData but test auth is allowed, create a fake telegram user
      if (!tgUser && allowTestAuth) {
        // Generate unique telegram ID for test user
        const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        tgUser = {
          id: parseInt(testId.replace(/\D/g, '').slice(0, 9)) || 999999999,
          first_name: name || "Test User",
          username: `testuser_${Date.now()}`,
        };
        console.log('[Auth] Test mode: Created fake Telegram user', tgUser);
      }

      if (!tgUser) {
        return res.status(401).json({ ok: false, error: "Invalid Telegram user" });
      }

      let user = await storage.getUserByTgId(tgUser.id.toString());
      const hasFullProfile = birthdayDate && birthPlace;

      if (!user) {
        // Create new user
        const referralCode = generateReferralCode();
        
        if (hasFullProfile) {
          // Full registration - user provided all data
          const birthday = new Date(birthdayDate);
          const age = Math.floor((Date.now() - birthday.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
          
          user = await storage.createUser({
            tgId: tgUser.id.toString(),
            username: tgUser.username || null,
            name: name || tgUser.first_name || "User",
            gender: gender || "other",
            age: Math.max(1, age),
            birthdayDate: birthday,
            birthTime: birthTime || null,
            birthPlace: birthPlace || null,
            timezone: timezone || "Europe/Moscow",
            referralCode,
            signupSource,
          });
        } else {
          // Minimal registration - just create user profile
          // User will complete registration later
          user = await storage.createUser({
            tgId: tgUser.id.toString(),
            username: tgUser.username || null,
            name: name || tgUser.first_name || "User",
            gender: "other",
            age: 25, // Default age
            birthdayDate: new Date(), // Placeholder
            birthTime: null,
            birthPlace: null,
            timezone: "Europe/Moscow",
            referralCode,
            signupSource,
          });
        }

        // Set initial energy and reset time
        await storage.updateUser(user.id, {
          freeEnergy: 10,
          energyResetAt: getNextResetTime(timezone || "Europe/Moscow"),
        });

        if (req.body.referralCode) {
          await applyReferralBonus(storage, user.id, req.body.referralCode);
        }
        
        // Refetch user with energy fields
        user = await storage.getUser(user.id) || user;
      } else if (hasFullProfile && (!user.birthPlace || user.birthPlace === null)) {
        // User exists but is completing registration (after reset or minimal signup)
        const birthday = new Date(birthdayDate);
        const age = Math.floor((Date.now() - birthday.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
        
        await storage.updateUser(user.id, {
          name: name || user.name,
          gender: gender || user.gender,
          age: Math.max(1, age),
          birthdayDate: birthday,
          birthTime: birthTime || null,
          birthPlace: birthPlace,
          timezone: timezone || user.timezone,
        });
        
        // Refetch updated user
        user = await storage.getUser(user.id) || user;
      }

      const token = generateToken(user.id);
      
      // Check if natal chart exists
      const natalChart = await storage.getNatalChart(user.id);

      res.json({ ok: true, data: { user: { ...user, natalInitialized: !!natalChart }, token } });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Telegram Login Widget (web login)
  app.post("/api/auth/tg-login", handleTelegramLoginWidget);

  app.post("/api/auth/test", async (req, res) => {
    // Allow in development or when explicitly enabled via ALLOW_TEST_AUTH flag
    const isTestAuthAllowed = process.env.NODE_ENV === 'development' || process.env.ALLOW_TEST_AUTH === 'true';
    
    if (!isTestAuthAllowed) {
      console.log('=== /api/auth/test BLOCKED ===');
      console.log('ALLOW_TEST_AUTH:', process.env.ALLOW_TEST_AUTH);
      console.log('NODE_ENV:', process.env.NODE_ENV);
      return res.status(403).json({ 
        ok: false, 
        error: "Test authentication is disabled. Please use Telegram Mini App or Login Widget." 
      });
    }
    
    console.log('=== /api/auth/test endpoint hit (test auth enabled) ===');
    console.log('Request body:', req.body);
    
    try {
      const { telegramId, firstName, lastName, username, name, gender, age, birthdayDate, birthTime, birthPlace, referralCode: inputReferralCode } = req.body;
      const resolvedTimezone = birthPlace ? await getTimezoneFromCity(birthPlace) : "Europe/Moscow";
      
      // Use provided telegramId or default to '999999999' for dev mode
      const testTgId = telegramId || '999999999';
      const testUsername = username || `devuser`;

      let user = await storage.getUserByTgId(testTgId);

      if (!user) {
        const referralCode = generateReferralCode();
        const displayName = firstName || name || "Dev User";
        
        const newUser = {
          tgId: testTgId,
          username: testUsername,
          name: displayName,
          gender: gender || "other",
          age: age || 25,
          birthdayDate: new Date(birthdayDate || new Date()),
          birthTime: birthTime || null,
          birthPlace: birthPlace || null,
          timezone: resolvedTimezone,
          referralCode,
          freeEnergy: 10,
          energyResetAt: getNextResetTime(resolvedTimezone),
        };

        user = await storage.createUser(newUser);

        if (inputReferralCode) {
          await applyReferralBonus(storage, user.id, inputReferralCode);
        }
      }

      const token = generateToken(user.id);
      
      // Check if natal chart exists
      const natalChart = await storage.getNatalChart(user.id);

      res.json({ ok: true, data: { user: { ...user, natalInitialized: !!natalChart }, token } });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Dev endpoint for testing referral system
  // Allows developers to simulate new user signups and subscriptions without creating real accounts
  app.post("/api/dev/test-referral", requireAuth, async (req, res) => {
    const isTestAuthAllowed = process.env.NODE_ENV === 'development' || process.env.ALLOW_TEST_AUTH === 'true';
    
    if (!isTestAuthAllowed) {
      return res.status(403).json({ 
        ok: false, 
        error: "Test referral endpoint is only available in development mode" 
      });
    }

    try {
      const userId = (req as any).userId;
      const { action } = req.body; // 'simulate_signup' or 'simulate_subscription'

      if (!action || !['simulate_signup', 'simulate_subscription'].includes(action)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid action. Use "simulate_signup" or "simulate_subscription"'
        });
      }

      // Get current user (the referrer)
      const referrer = await storage.getUser(userId);
      if (!referrer) {
        return res.status(404).json({ ok: false, error: 'User not found' });
      }

      if (action === 'simulate_signup') {
        // Create a virtual test user and apply referral bonus
        const testUser = {
          tgId: `virtual_test_${Date.now()}`,
          username: `test_referred_${Date.now()}`,
          name: `Test User ${Date.now()}`,
          gender: 'other' as const,
          age: 25,
          birthdayDate: new Date(),
          birthTime: null,
          birthPlace: null,
          timezone: "America/New_York",
          referralCode: generateReferralCode(),
          freeEnergy: 10,
          energyResetAt: getNextResetTime("America/New_York"),
        };

        const newUser = await storage.createUser(testUser);

        // Apply referral bonus (this will credit referrer and create referral reward)
        await applyReferralBonus(storage, newUser.id, referrer.referralCode);

        // Get updated referrer data
        const updatedReferrer = await storage.getUser(userId);

        return res.json({
          ok: true,
          data: {
            action: 'simulate_signup',
            testUser: {
              id: newUser.id,
              name: newUser.name,
              username: newUser.username,
            },
            referrer: {
              id: updatedReferrer?.id,
              name: updatedReferrer?.name,
              purchasedEnergy: updatedReferrer?.purchasedEnergy,
            },
            rewardAmount: 5,
            message: 'Simulated new user signup via your referral code. You received +5 energy!',
          },
        });
      }

      if (action === 'simulate_subscription') {
        // Self-contained: create a virtual referred user, link them to the referrer,
        // then trigger the subscription referral bonus (as if the friend just paid).
        const testUser = {
          tgId: `virtual_test_${Date.now()}`,
          username: `test_referred_${Date.now()}`,
          name: `Test User ${Date.now()}`,
          gender: 'other' as const,
          age: 25,
          birthdayDate: new Date(),
          birthTime: null,
          birthPlace: null,
          timezone: "America/New_York",
          referralCode: generateReferralCode(),
          freeEnergy: 10,
          energyResetAt: getNextResetTime("America/New_York"),
          referredById: referrer.id,
        };

        const referredUser = await storage.createUser(testUser);

        // Apply subscription referral bonus.
        // Free referrer → creates a pending choice. Standard/Premium → applies orbs + extension.
        await handleSubscriptionReferralBonus(storage, referredUser.id);

        // Get updated referrer data
        const updatedReferrer = await storage.getUser(userId);
        const referrerTier = await getUserTier(storage, userId);

        return res.json({
          ok: true,
          data: {
            action: 'simulate_subscription',
            referredUser: {
              id: referredUser.id,
              name: referredUser.name,
            },
            referrer: {
              id: updatedReferrer?.id,
              name: updatedReferrer?.name,
            },
            referrerTier,
            requiresChoice: referrerTier === 'free',
            message: referrerTier === 'free'
              ? 'Simulated subscription purchase. Choose your reward: 7 days Standard or 3 days Premium.'
              : 'Simulated subscription purchase by your referred user. Reward applied.',
          },
        });
      }

      res.status(400).json({ ok: false, error: 'Invalid action' });
    } catch (error: any) {
      console.error('[DEV] Test referral error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/cities/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string || '10', 10);
      
      const cities = searchCities(query || '', Math.min(limit, 50));
      
      res.json({ ok: true, data: cities });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/user/me", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      
      // Import new orb functions
      const { getUserOrbs, getUserTier, checkAndResetOrbs } = await import('./lib/energy.js');
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      // IMPORTANT: Check subscription expiry to keep dashboard status accurate
      const subscription = await checkSubscriptionExpiry(storage, userId);
      const natalChart = await storage.getNatalChart(userId);
      
      // IMPORTANT: Reset monthly orbs if needed (for Standard subscribers)
      await checkAndResetOrbs(storage, userId);
      
      // Get orb info for new system
      const orbInfo = await getUserOrbs(storage, userId);
      const tier = await getUserTier(storage, userId);

      res.json({ ok: true, data: { 
        ...user, 
        // Legacy energy field for backward compatibility
        energy: (user.freeEnergy || 0) + (user.purchasedEnergy || 0),
        // New orb system
        orbs: orbInfo.total,
        maxOrbs: orbInfo.maxOrbs,
        tier,
        orbsResetAt: user.orbsResetAt,
        subscription, 
        natalInitialized: !!natalChart 
      } });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/user/update", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { name, gender, age, birthdayDate, birthTime, birthPlace } = req.body;

      // Get current user to check last profile update
      const currentUser = await storage.getUser(userId);
      
      if (currentUser?.lastProfileUpdate) {
        const lastUpdate = new Date(currentUser.lastProfileUpdate);
        const now = new Date();
        const daysSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Require 30 days (1 month) between profile updates
        if (daysSinceUpdate < 30) {
          const daysRemaining = 30 - daysSinceUpdate;
          return res.status(400).json({ 
            ok: false, 
            error: `Profile can only be updated once per month. You can update again in ${daysRemaining} days.`,
            daysRemaining 
          });
        }
      }

      const resolvedTimezone = birthPlace ? await getTimezoneFromCity(birthPlace) : (currentUser?.timezone || "Europe/Moscow");
      const user = await storage.updateUser(userId, {
        name,
        gender,
        age,
        birthdayDate: new Date(birthdayDate),
        birthTime,
        birthPlace,
        timezone: resolvedTimezone,
        lastProfileUpdate: new Date(),
      });

      res.json({ ok: true, data: user });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Reset user profile to registration state
  app.post("/api/user/reset-profile", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;

      // Delete natal chart if exists
      await storage.deleteNatalChart(userId);

      // Reset profile data to registration state
      const user = await storage.updateUser(userId, {
        birthPlace: null,
        birthTime: null,
        natalChart: null,
        lastProfileUpdate: null,
      });

      res.json({ 
        ok: true, 
        data: user,
        message: "Profile reset successfully. Please complete registration again."
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Cancel subscription
  app.post("/api/user/subscription/cancel", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      
      const subscription = await storage.getSubscription(userId);
      
      if (!subscription) {
        return res.status(404).json({ ok: false, error: "No active subscription found" });
      }
      
      if (subscription.status !== 'active') {
        return res.status(400).json({ ok: false, error: "Subscription is not active" });
      }
      
      // Update status to canceled - user keeps benefits until currentPeriodEnd
      await storage.updateSubscription(subscription.id, { status: 'canceled' });
      
      res.json({ 
        ok: true, 
        data: { 
          message: "Subscription canceled successfully. Benefits remain until period end.",
          currentPeriodEnd: subscription.currentPeriodEnd 
        } 
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // DEV ONLY: Free subscription activation for testing
  app.post("/api/dev/subscribe", requireAuth, async (req, res) => {
    // Only allow in development mode
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ ok: false, error: "Only available in development mode" });
    }
    
    try {
      const userId = (req as any).userId;
      const { tier } = req.body;
      
      if (!tier || (tier !== 'standard' && tier !== 'pro' && tier !== 'premium')) {
        return res.status(400).json({ ok: false, error: "Invalid tier. Use 'standard', 'pro', or 'premium'" });
      }
      const activated = await activateSubscriptionForUser(storage, {
        userId,
        tier: tier as any,
        periodDays: 30,
        source: 'dev',
      });
      const currentPeriodEnd = activated.currentPeriodEnd;
      
      res.json({ 
        ok: true, 
        data: { 
          message: `DEV: ${tier} subscription activated for 30 days`,
          tier,
          currentPeriodEnd 
        } 
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Natal chart init (FREE - creates user's own natal chart)
  app.post("/api/natal/init", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const chart = await ensureUserNatalChart(userId);
      res.json({ ok: true, data: chart });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Get user's own natal chart
  app.get("/api/natal/me", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const locale = (req.query.locale as string) || 'ru';
      
      console.log(`[GET /api/natal/me] User: ${userId}, Locale: ${locale}`);
      
      // Auto-recalculate if profile changed
      await recomputeIfProfileChanged(userId);
      
      const chart = await storage.getNatalChart(userId);
      
      if (!chart) {
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }
      
      console.log(`[GET /api/natal/me] Chart found, professionalInterpretation exists: ${!!chart.professionalInterpretation}`);
      if (chart.professionalInterpretation) {
        console.log(`[GET /api/natal/me] Available locales: ${Object.keys(chart.professionalInterpretation as any)}`);
      }
      
      // Ensure professional interpretation is generated for current locale
      await ensureNatalInterpretation(userId, locale);
      
      // Refetch chart with updated interpretation
      const updatedChart = await storage.getNatalChart(userId);
      
      console.log(`[GET /api/natal/me] After ensureNatalInterpretation, professionalInterpretation exists: ${!!updatedChart?.professionalInterpretation}`);
      if (updatedChart?.professionalInterpretation) {
        console.log(`[GET /api/natal/me] Available locales after: ${Object.keys(updatedChart.professionalInterpretation as any)}`);
      }
      
      res.json({ ok: true, data: updatedChart });
    } catch (error: any) {
      console.error('[GET /api/natal/me] Error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Force recalculate natal chart (FREE for own chart)
  app.post("/api/natal/recalculate", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      
      // Force recalculation (clears cached interpretations)
      const newData = await computeNatalFromUser(user);
      await storage.updateNatalChart(userId, { 
        data: newData,
        professionalInterpretation: null, // Clear cached interpretations
      });
      
      const updatedChart = await storage.getNatalChart(userId);
      res.json({ ok: true, data: updatedChart });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Create external natal chart (costs 1 orb)
  app.post("/api/natal/external", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      
      const externalNatalSchema = z.object({
        name: z.string().min(1),
        gender: z.enum(["male", "female", "other"]),
        birthdayDate: z.string(),
        birthTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
        birthPlace: z.string().optional().nullable(),
        locale: z.string().default("ru"),
      });
      
      const data = externalNatalSchema.parse(req.body);
      
      // Deduct energy first (will check and reset if needed)
      const deductResult = await deductEnergy(storage, userId, "natal_external");
      if (!deductResult.ok) {
        return res.status(400).json({ ok: false, error: deductResult.error });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      
      // Parse date safely to avoid timezone issues
      const birthdayStr = data.birthdayDate;
      const [datePart] = birthdayStr.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      
      const birthTimeStr = data.birthTime || "12:00";
      const [localHours, localMinutes] = birthTimeStr.split(":").map(Number);
      
      // Geocode birth city to get coordinates
      const coords = await geocodeCityWithFallback(data.birthPlace || null);
      
      // Auto-resolve timezone from birth place
      const userTimezone = await getTimezoneFromCity(data.birthPlace || null);
      const localDateTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}:00`;
      const localDateTime = dayjs.tz(localDateTimeStr, userTimezone);
      const utcDateTime = localDateTime.utc();
      
      const pythonChart = await calculateNatalChartPython({
        year: utcDateTime.year(),
        month: utcDateTime.month() + 1,
        day: utcDateTime.date(),
        hour: utcDateTime.hour(),
        minute: utcDateTime.minute(),
        latitude: coords.lat,
        longitude: coords.lon,
      });
      
      // Generate AI interpretation
      const interpretation = await getAstrologyInterpretation(
        "natal",
        pythonChart,
        data.locale,
        data.gender
      );
      
      const natalData = {
        ...pythonChart,
        interpretation,
      };
      
      const externalNatal = await storage.createExternalNatal({
        ownerId: userId,
        name: data.name,
        gender: data.gender,
        birthdayDate: new Date(data.birthdayDate),
        birthTime: data.birthTime || null,
        birthPlace: data.birthPlace || null,
        timezone: userTimezone,
        data: natalData,
      });
      
      res.json({ ok: true, data: externalNatal });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Get list of external natal charts
  app.get("/api/natal/external", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const charts = await storage.getExternalNatalsByOwnerId(userId);
      res.json({ ok: true, data: charts });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Get specific external natal chart
  app.get("/api/natal/external/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const chartId = req.params.id;
      
      const chart = await storage.getExternalNatal(chartId);
      
      if (!chart) {
        return res.status(404).json({ ok: false, error: "Chart not found" });
      }
      
      // Verify ownership
      if (chart.ownerId !== userId) {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }
      
      res.json({ ok: true, data: chart });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Delete external natal chart
  app.delete("/api/natal/external/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const chartId = req.params.id;
      
      const chart = await storage.getExternalNatal(chartId);
      
      if (!chart) {
        return res.status(404).json({ ok: false, error: "Chart not found" });
      }
      
      // Verify ownership
      if (chart.ownerId !== userId) {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }
      
      await storage.deleteExternalNatal(chartId);
      
      res.json({ ok: true, message: "Chart deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/energy", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { getUserOrbs } = await import('./lib/energy.js');
      const orbInfo = await getUserOrbs(storage, userId);

      res.json({
        ok: true,
        data: {
          energy: orbInfo.total,
          resetAt: (await storage.getUser(userId))?.orbsResetAt || new Date(),
        },
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/natal", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const locale = req.body.locale || 'en';
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      // Use new caching system - get or create natal chart
      const natalChart = await ensureUserNatalChart(userId);
      const savedChart = natalChart.data as NatalChartResult;
      
      // Get cached interpretation or generate new one
      const interpretation = await ensureNatalInterpretation(userId, locale);
      
      // Transform planets from object to array for frontend
      const planetsArray = Object.entries(savedChart.planets).map(([name, data]) => ({
        name,
        sign: data.sign,
        position: data.longitude,
        longitude: data.longitude,
        latitude: data.latitude,
        degree_in_sign: data.degree_in_sign,
      }));
      
      res.json({
        ok: true,
        data: {
          planets: planetsArray,
          houses: savedChart.houses,
          angles: savedChart.angles,
          aspects: [],
          interpretation,
        },
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // DEPRECATED - old natal endpoint, keeping for backward compatibility
  app.post("/api/astrology/natal/old", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const locale = req.body.locale || 'en';
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      if (!user.birthTime) {
        return res.status(400).json({ 
          ok: false, 
          error: "Birth time is required for natal chart calculation" 
        });
      }

      const birthDate = new Date(user.birthdayDate);
      const [hours, minutes] = user.birthTime.split(':').map(Number);
      
      // Geocode birth city to get coordinates
      const coords = await geocodeCityWithFallback(user.birthPlace);

      const pythonChart = await calculateNatalChartPython({
        year: birthDate.getFullYear(),
        month: birthDate.getMonth() + 1,
        day: birthDate.getDate(),
        hour: hours,
        minute: minutes,
        latitude: coords.lat,
        longitude: coords.lon,
        house_system: 'Placidus',
      });

      // Преобразуем planets из объекта в массив для фронтенда
      const planetsArray = Object.entries(pythonChart.planets).map(([name, data]) => ({
        name,
        sign: data.sign,
        position: data.longitude, // Python возвращает longitude, фронтенд ожидает position
        longitude: data.longitude,
        latitude: data.latitude,
        degree_in_sign: data.degree_in_sign,
      }));

      // Генерируем AI интерпретацию
      const interpretation = await getAstrologyInterpretation("natal", pythonChart, locale, user.gender);

      // Сохраняем натальную карту С ИНТЕРПРЕТАЦИЕЙ в профиле пользователя (бесплатно, навсегда)
      const chartToSave: StoredNatalChart = {
        ...pythonChart,
        interpretation, // Добавляем интерпретацию в сохранённые данные
      };
      
      await storage.updateUser(userId, { 
        natalChart: chartToSave 
      });

      // Также сохраняем в историю чтений
      await storage.createNatalReading({
        userId,
        planets: pythonChart.planets,
        aspects: [], // Python версия пока не рассчитывает аспекты
        interpretation,
      });

      res.json({
        ok: true,
        data: {
          planets: planetsArray,
          houses: pythonChart.houses,
          angles: pythonChart.angles,
          aspects: [], // Python версия пока не рассчитывает аспекты
          interpretation,
        },
      });
    } catch (error: any) {
      console.error('Natal chart calculation error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Planet interpretation endpoint
  // mode='brief' → FREE for all users (short description of what the planet is responsible for)
  // mode='detailed' → PAID (2 stars) for subscribers (full interpretation with strengths/risks/advice)
  app.post("/api/astrology/planet-interpretation", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { planet, locale = 'ru', chartType = 'own', chartId, mode = 'brief' } = req.body;
      
      const validPlanets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node'];
      if (!planet || !validPlanets.includes(planet)) {
        return res.status(400).json({ 
          ok: false, 
          error: 'Invalid planet. Must be one of: ' + validPlanets.join(', ') 
        });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      let savedChart: NatalChartResult;
      let chartOwner = user;

      if (chartType === 'guest' && chartId) {
        const guestChart = await storage.getExternalNatal(chartId);
        
        if (!guestChart) {
          return res.status(404).json({ ok: false, error: "Guest chart not found" });
        }
        
        if (guestChart.ownerId !== userId) {
          return res.status(403).json({ ok: false, error: "Access denied" });
        }
        
        if (!guestChart.data || typeof guestChart.data !== 'object' || !('planets' in guestChart.data)) {
          return res.status(400).json({ 
            ok: false, 
            error: 'Guest chart data is invalid' 
          });
        }
        
        savedChart = guestChart.data as NatalChartResult;
        chartOwner = {
          ...user,
          name: guestChart.name,
          gender: guestChart.gender,
          birthdayDate: guestChart.birthdayDate
        } as any;
      } else {
        const ownChart = await storage.getNatalChart(userId);
        
        if (!ownChart || !ownChart.data || typeof ownChart.data !== 'object' || !('planets' in ownChart.data)) {
          return res.status(400).json({ 
            ok: false, 
            error: 'Natal chart not found. Please generate your natal chart first.' 
          });
        }
        
        savedChart = ownChart.data as NatalChartResult;
      }

      const planetData = savedChart.planets[planet];
      
      if (!planetData) {
        return res.status(404).json({ 
          ok: false, 
          error: locale === 'ru' 
            ? `${planet} не найден в вашей натальной карте. Попробуйте перегенерировать карту.`
            : `${planet} not found in your natal chart. Try regenerating your chart.`
        });
      }

      const findHouse = (longitude: number): number => {
        if (!savedChart.houses || !Array.isArray(savedChart.houses.cusps)) return 1;
        const cusps = savedChart.houses.cusps;
        for (let i = 0; i < 12; i++) {
          const houseStart = cusps[i];
          const nextHouseStart = cusps[(i + 1) % 12];
          if (houseStart > nextHouseStart) {
            if (longitude >= houseStart || longitude < nextHouseStart) return i + 1;
          } else {
            if (longitude >= houseStart && longitude < nextHouseStart) return i + 1;
          }
        }
        return 1;
      };

      const house = findHouse(planetData.longitude);

      const chartAspects = (savedChart as any).aspects || [];
      const planetAspects = chartAspects.filter((aspect: any) => 
        aspect.planet1 === planet || aspect.planet2 === planet
      ).map((aspect: any) => ({
        to: aspect.planet1 === planet ? aspect.planet2 : aspect.planet1,
        type: aspect.type,
        orb_deg: aspect.orb
      }));

      const interpretationData: PlanetInterpretationData = {
        planet: {
          name: planet,
          sign: planetData.sign,
          house,
          aspects: planetAspects
        },
        profile: {
          name: chartOwner.name,
          age: chartOwner.birthdayDate ? new Date().getFullYear() - new Date(chartOwner.birthdayDate).getFullYear() : undefined,
          gender: chartOwner.gender || undefined
        }
      };

      const { getUserTier, deductOrbs } = await import('./lib/energy.js');
      const tier = await getUserTier(storage, userId);

      // BRIEF MODE: Free for all users — short description of what the planet does
      if (mode === 'brief') {
        const { getPlanetShortInterpretation } = await import('./lib/openai.js');
        const shortInterpretation = await getPlanetShortInterpretation(interpretationData, locale);
        
        return res.json({
          ok: true,
          data: {
            ...shortInterpretation,
            isShort: true,
            requiresSubscription: tier === 'free'
          }
        });
      }

      // DETAILED MODE: Costs 2 stars — full interpretation with strengths/risks/advice
      if (tier === 'free') {
        return res.status(402).json({
          ok: false,
          error: locale === 'ru' ? 'Необходима подписка' : 'Subscription required',
          requiresSubscription: true
        });
      }

      const deductResult = await deductOrbs(storage, userId, 'planet_interpretation');
      if (!deductResult.ok) {
        return res.status(402).json({
          ok: false,
          error: locale === 'ru' ? 'Недостаточно звёзд' : 'Insufficient stars',
          required: ORB_COSTS.planet_interpretation,
          available: deductResult.available || 0
        });
      }
      
      const interpretation = await getPlanetInterpretation(interpretationData, locale);

      res.json({
        ok: true,
        data: {
          ...interpretation,
          isShort: false,
          requiresSubscription: false
        }
      });
    } catch (error: any) {
      console.error('Planet interpretation error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Роут для проверки статуса купленных интерпретаций (бесплатно)
  app.get("/api/astrology/house-influence-status", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { chartType = 'own', chartId } = req.query;
      
      // Для гостевых карт - всегда платно (нет кэша)
      if (chartType === 'guest') {
        return res.json({
          ok: true,
          data: {} // Пустой объект - ничего не куплено
        });
      }
      
      // Для своей карты - проверяем кэш
      const ownChart = await storage.getNatalChart(userId);
      if (!ownChart) {
        return res.json({
          ok: true,
          data: {} // Нет карты - ничего не куплено
        });
      }
      
      const houseInfluences = (ownChart.houseInfluences as any) || {};
      
      res.json({
        ok: true,
        data: houseInfluences // Возвращаем структуру { "ru": { "Sun": true, "Moon": true }, "en": {...} }
      });
    } catch (error: any) {
      console.error('House influence status check error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Роут для интерпретации влияния дома на планету
  // ДЛЯ СВОЕЙ КАРТЫ: Первый раз платно (2 орба), потом бесплатно из кэша
  // ДЛЯ ГОСТЕВЫХ КАРТ: Всегда платно (2 орба), не сохраняется
  app.post("/api/astrology/house-influence", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { planet, locale = 'ru', chartType = 'own', chartId } = req.body;
      
      // Валидация планеты
      const validPlanets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node'];
      if (!planet || !validPlanets.includes(planet)) {
        return res.status(400).json({ 
          ok: false, 
          error: 'Invalid planet. Must be one of: ' + validPlanets.join(', ') 
        });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      let savedChart: NatalChartResult;
      let chartOwner = user;
      let chartRecord: any = null;

      // Получаем данные карты в зависимости от типа
      if (chartType === 'guest' && chartId) {
        // Загружаем гостевую карту (ВСЕГДА ПЛАТНО)
        const guestChart = await storage.getExternalNatal(chartId);
        
        if (!guestChart) {
          return res.status(404).json({ ok: false, error: "Guest chart not found" });
        }
        
        // Проверяем владельца
        if (guestChart.ownerId !== userId) {
          return res.status(403).json({ ok: false, error: "Access denied" });
        }
        
        if (!guestChart.data || typeof guestChart.data !== 'object' || !('planets' in guestChart.data)) {
          return res.status(400).json({ 
            ok: false, 
            error: 'Guest chart data is invalid' 
          });
        }
        
        savedChart = guestChart.data as NatalChartResult;
        chartOwner = {
          ...user,
          name: guestChart.name,
          gender: guestChart.gender,
          birthdayDate: guestChart.birthdayDate
        } as any;
        // chartRecord остается null для гостевых карт
      } else {
        // Получаем СВОЮ натальную карту (может быть кэш)
        const ownChart = await storage.getNatalChart(userId);
        
        if (!ownChart || !ownChart.data || typeof ownChart.data !== 'object' || !('planets' in ownChart.data)) {
          return res.status(400).json({ 
            ok: false, 
            error: 'Natal chart not found. Please generate your natal chart first.' 
          });
        }
        
        savedChart = ownChart.data as NatalChartResult;
        chartRecord = ownChart;
        
        // КРИТИЧНО: Проверяем кэш для СВОЕЙ карты
        const houseInfluences = (ownChart.houseInfluences as any) || {};
        const localeCache = houseInfluences[locale] || {};
        
        if (localeCache[planet]) {
          console.log(`[House Influence] Cache HIT for own chart: ${planet} (${locale})`);
          // ВОЗВРАЩАЕМ БЕСПЛАТНО ИЗ КЭША
          return res.json({
            ok: true,
            data: localeCache[planet],
            cached: true
          });
        }
        
        console.log(`[House Influence] Cache MISS for own chart: ${planet} (${locale})`);
      }

      const planetData = savedChart.planets[planet];
      
      if (!planetData) {
        return res.status(404).json({ 
          ok: false, 
          error: locale === 'ru' 
            ? `${planet} не найден в вашей натальной карте. Попробуйте перегенерировать карту.`
            : `${planet} not found in your natal chart. Try regenerating your chart.`
        });
      }

      // Определяем дом, в котором находится планета
      const findHouse = (longitude: number): number => {
        if (!savedChart.houses || !Array.isArray(savedChart.houses.cusps)) return 1;
        
        const cusps = savedChart.houses.cusps;
        
        for (let i = 0; i < 12; i++) {
          const houseStart = cusps[i];
          const nextHouseStart = cusps[(i + 1) % 12];
          
          if (houseStart > nextHouseStart) {
            if (longitude >= houseStart || longitude < nextHouseStart) {
              return i + 1;
            }
          } else {
            if (longitude >= houseStart && longitude < nextHouseStart) {
              return i + 1;
            }
          }
        }
        return 1;
      };

      const house = findHouse(planetData.longitude);

      // ПЛАТНО: Проверяем и списываем энергию (для обеих типов карт)
      // Списываем звёзды
      const deductResult = await deductEnergy(storage, userId, "house_influence");
      if (!deductResult.ok) {
        return res.status(402).json({ ok: false, error: deductResult.error });
      }

      // Формируем данные для интерпретации влияния дома
      const houseInfluenceData: HouseInfluenceData = {
        planet: {
          name: planet,
          sign: planetData.sign,
          house
        },
        profile: {
          name: chartOwner.name,
          age: chartOwner.birthdayDate ? new Date().getFullYear() - new Date(chartOwner.birthdayDate).getFullYear() : undefined,
          gender: chartOwner.gender || undefined
        }
      };

      // Получаем интерпретацию влияния дома от AI
      const interpretation = await getHouseInfluence(houseInfluenceData, locale);

      // СОХРАНЯЕМ В КЭШ (только для своей карты)
      if (chartRecord) {
        const currentInfluences = (chartRecord.houseInfluences as any) || {};
        const localeInfluences = currentInfluences[locale] || {};
        
        // Добавляем новую интерпретацию
        localeInfluences[planet] = interpretation;
        currentInfluences[locale] = localeInfluences;
        
        // Сохраняем в базу
        await storage.updateNatalChart(userId, {
          houseInfluences: currentInfluences
        });
        
        console.log(`[House Influence] Saved to cache: ${planet} (${locale})`);
      }

      res.json({
        ok: true,
        data: interpretation,
        cached: false
      });
    } catch (error: any) {
      console.error('House influence interpretation error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Check if solar return is cached for a specific year and location
  app.post("/api/astrology/solar/check", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { targetYear, location } = req.body;

      if (!targetYear) {
        return res.status(400).json({ ok: false, error: "targetYear is required" });
      }
      if (!location || !location.trim()) {
        return res.status(400).json({ ok: false, error: "location is required" });
      }

      const cachedSolar = await storage.getSolarReturn(userId, targetYear, location.trim().toLowerCase());
      
      res.json({
        ok: true,
        cached: !!cachedSolar,
      });
    } catch (error: any) {
      console.error('[SOLAR CHECK] Error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/solar", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const locale = req.body.locale || 'en';
      const { targetYear, location } = req.body;
      
      // Validate inputs
      if (!targetYear) {
        return res.status(400).json({ ok: false, error: "targetYear is required" });
      }
      if (!location || !location.trim()) {
        return res.status(400).json({ ok: false, error: "location is required" });
      }
      
      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      // STRICT NATAL CHART CHECK (from TZ requirement)
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart || !natalChart.data) {
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }

      // Check if natal chart has precise time and place
      if (!user.birthTime || !user.birthPlace) {
        return res.status(409).json({ ok: false, error: "NATAL_INCOMPLETE" });
      }

      // CHECK CACHE FIRST (per TZ requirement - no energy deduction for cached)
      const normalizedLocation = location.trim().toLowerCase();
      const cachedSolar = await storage.getSolarReturn(userId, targetYear, normalizedLocation);
      if (cachedSolar) {
        console.log(`[SOLAR] Using cached solar return for year ${targetYear}, location: ${location}`);
        
        // Remove insights field from cached data (backward compatibility)
        const cleanedData = { ...cachedSolar.data };
        delete cleanedData.insights;
        
        return res.json({
          ok: true,
          data: cleanedData,
          cached: true,
        });
      }

      // Not in cache - check access (Premium-only feature)
      const { canAccessFeature: checkAccess } = await import('./lib/energy.js');
      const accessCheck = await checkAccess(storage, userId, 'solar_return');
      
      if (!accessCheck.allowed) {
        if (accessCheck.requiresPremium) {
          return res.status(403).json({ ok: false, error: "Premium subscription required for Solar Return" });
        }
        if (accessCheck.requiresSubscription) {
          return res.status(402).json({ ok: false, error: "Subscription required" });
        }
        return res.status(402).json({ ok: false, error: "Insufficient stars" });
      }

      // Get natal Sun longitude for accurate Solar Return calculation
      let natalSunLongitude = natalChart.natalSunLongitude;
      
      // If natalSunLongitude is missing (legacy charts), extract from chart data
      if (!natalSunLongitude) {
        const chartData = natalChart.data as NatalChartResult;
        const sunLongitude = chartData?.planets?.Sun?.longitude;
        
        if (!sunLongitude) {
          return res.status(500).json({ 
            ok: false, 
            error: "Natal Sun longitude not found. Please recalculate your natal chart." 
          });
        }
        
        // Save it for future use
        natalSunLongitude = sunLongitude.toString();
        await storage.updateNatalChart(userId, { 
          natalSunLongitude 
        });
        console.log(`[SOLAR] Extracted and saved natal Sun longitude: ${natalSunLongitude}°`);
      } else {
        console.log(`[SOLAR] Using cached natal Sun longitude: ${natalSunLongitude}°`);
      }
      
      // Calculate exact Solar Return time (when Sun returns to natal position)
      const birthDate = new Date(user.birthdayDate);
      const birthMonth = birthDate.getMonth() + 1; // 1-12
      const birthDay = birthDate.getDate();
      
      const solarReturnTime = await calculateSolarReturnTime({
        natal_sun_longitude: parseFloat(natalSunLongitude),
        birth_month: birthMonth,
        birth_day: birthDay,
        target_year: targetYear,
      });
      
      console.log(`[SOLAR] Exact Solar Return time:`, solarReturnTime);
      
      // Geocode location (where user will be on birthday) to get coordinates
      const coords = await geocodeCityWithFallback(location.trim());
      
      const solarChartData = await calculateNatalChartPython({
        year: solarReturnTime.year,
        month: solarReturnTime.month,
        day: solarReturnTime.day,
        hour: solarReturnTime.hour,
        minute: solarReturnTime.minute,
        latitude: coords.lat,
        longitude: coords.lon,
        house_system: 'Placidus',
      });
      
      // Create exact Solar Return date from calculated time
      const exactSolarDate = new Date(
        solarReturnTime.year,
        solarReturnTime.month - 1, // JS months are 0-indexed
        solarReturnTime.day,
        solarReturnTime.hour,
        solarReturnTime.minute
      );
      
      // Pass full Solar Return chart data for AI interpretation
      const solarData = {
        chart: solarChartData, // Complete chart: planets, houses, aspects, angles
        date: exactSolarDate,
        location: location.trim(), // User-provided location string
        targetYear: targetYear,
      };
      
      const interpretation = await getAstrologyInterpretation("solar", solarData, locale, user.gender);

      // Prepare full response data
      const responseData = {
        solar: {
          position: solarChartData.planets['Sun'].longitude,
          sign: solarChartData.planets['Sun'].sign,
          date: exactSolarDate,
        },
        interpretation,
      };

      // SAVE TO CACHE (per TZ requirement)
      await storage.createSolarReturn({
        userId,
        targetYear,
        location: normalizedLocation,
        data: responseData,
      });

      // DEDUCT ORBS AFTER SUCCESSFUL CALCULATION
      const { deductOrbs: deductSolarOrbs } = await import('./lib/energy.js');
      const deductResult = await deductSolarOrbs(storage, userId, 'solar_return');
      if (!deductResult.ok) {
        console.error('[SOLAR] Failed to deduct orbs after calculation:', deductResult.error);
      }

      console.log(`[SOLAR] Calculated and cached solar return for year ${targetYear}`);

      res.json({
        ok: true,
        data: responseData,
        cached: false,
      });
    } catch (error: any) {
      console.error('[SOLAR] Error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/horoscope", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const locale = req.body.locale || 'ru';

      console.log('[HOROSCOPE] Request started - userId:', userId, 'locale:', locale);

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      // Check if natal chart exists in database
      const natalChart = await storage.getNatalChart(userId);
      console.log('[HOROSCOPE] Natal chart exists:', !!natalChart);
      if (!natalChart || !natalChart.data) {
        console.log('[HOROSCOPE] ERROR: NATAL_NOT_INITIALIZED');
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }

      console.log('[HOROSCOPE] Calling interpretHoroscope...');

      // Calculate today's transits
      const nowTime = dayjs().tz(user.timezone);
      const transitData = {
        year: nowTime.year(),
        month: nowTime.month() + 1, // dayjs months are 0-indexed
        day: nowTime.date(),
        hour: nowTime.hour(),
        minute: nowTime.minute(),
      };

      console.log('[HOROSCOPE] Calculating transits for:', transitData);
      const transits = await calculateTransits(transitData);
      console.log('[HOROSCOPE] Transits calculated:', Object.keys(transits.planets).length, 'planets');

      // Map transits to natal houses
      const transitsInNatalHouses = mapTransitsToNatalHouses(transits, natalChart.data);
      console.log('[HOROSCOPE] Transits mapped to natal houses');

      // Generate daily horoscope with transits
      const result = await interpretHoroscope({
        profile: {
          name: user.name,
          gender: user.gender,
          timezone: user.timezone
        },
        natal: natalChart.data,
        transits: transitsInNatalHouses
      }, locale);

      console.log('[HOROSCOPE] interpretHoroscope returned successfully');

      // Save to database with today's date
      const today = nowTime.format('YYYY-MM-DD');

      await storage.createHoroscopeReading({
        userId,
        period: 'day',
        startDate: today,
        endDate: today,
        forecast: JSON.stringify(result),
      });

      console.log('[HOROSCOPE] Saved to database');

      // Deduct stars after successful execution
      const deductResult = await deductEnergy(storage, userId, 'horoscope');
      if (!deductResult.ok) {
        console.log('[HOROSCOPE] Failed to deduct stars:', deductResult.error);
      }

      console.log('[HOROSCOPE] Request completed successfully');

      res.json({
        ok: true,
        data: result
      });
    } catch (error: any) {
      console.error('[HOROSCOPE] Error occurred:', error.message);
      console.error('[HOROSCOPE] Error stack:', error.stack);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/horoscope/weekly-plan", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { week_start_iso, week_end_iso } = req.body;
      const locale = req.body.locale || 'ru';

      console.log('[WEEKLY_PLAN] User ID:', userId);
      console.log('[WEEKLY_PLAN] Request body:', { week_start_iso, week_end_iso, locale });

      const user = await storage.getUser(userId);
      if (!user) {
        console.log('[WEEKLY_PLAN] User not found');
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      // Check if natal chart exists in database
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart || !natalChart.data) {
        console.log('[WEEKLY_PLAN] Natal chart not initialized');
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }

      console.log('[WEEKLY_PLAN] Natal chart exists');

      // Calculate week start (always Monday of current week if not provided)
      let weekStart = week_start_iso;
      if (!weekStart) {
        const now = dayjs().tz(user.timezone);
        // Get Monday of current week (0=Sunday, 1=Monday, ..., 6=Saturday)
        const dayOfWeek = now.day();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days
        const monday = now.subtract(daysFromMonday, 'day');
        weekStart = monday.format('YYYY-MM-DD');
      }

      // Use provided week end or calculate as start + 6 days
      let weekEnd = week_end_iso;
      if (!weekEnd) {
        weekEnd = dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD');
      }

      console.log('[WEEKLY_PLAN] Week range:', weekStart, 'to', weekEnd);

      // Calculate transits for the start of the week
      const weekStartDate = dayjs(weekStart).tz(user.timezone);
      const transitData = {
        year: weekStartDate.year(),
        month: weekStartDate.month() + 1,
        day: weekStartDate.date(),
        hour: 12, // Noon on Monday
        minute: 0,
      };

      console.log('[WEEKLY_PLAN] Calculating transits for:', transitData);
      const transits = await calculateTransits(transitData);
      console.log('[WEEKLY_PLAN] Transits calculated:', Object.keys(transits.planets).length, 'planets');

      // Map transits to natal houses
      const transitsInNatalHouses = mapTransitsToNatalHouses(transits, natalChart.data);
      console.log('[WEEKLY_PLAN] Transits mapped to natal houses');

      // Generate weekly plan
      console.log('[WEEKLY_PLAN] Calling generateWeeklyPlan...');
      const result = await generateWeeklyPlan({
        profile: {
          name: user.name,
          gender: user.gender,
          timezone: user.timezone
        },
        natal: natalChart.data,
        week_start_iso: weekStart,
        transits: transitsInNatalHouses
      }, locale);

      console.log('[WEEKLY_PLAN] Result received:', JSON.stringify(result).substring(0, 200));

      // Save weekly plan to database with date range
      await storage.createHoroscopeReading({
        userId,
        period: 'week',
        startDate: weekStart,
        endDate: weekEnd,
        forecast: JSON.stringify(result),
        data: result,
      });

      // Deduct stars after successful execution
      const weeklyDeductResult = await deductEnergy(storage, userId, 'weekly_plan');
      if (!weeklyDeductResult.ok) {
        console.log('[WEEKLY_PLAN] Failed to deduct stars:', weeklyDeductResult.error);
      } else {
        console.log('[WEEKLY_PLAN] Stars deducted successfully');
      }

      res.json({
        ok: true,
        data: result
      });
    } catch (error: any) {
      console.error('[WEEKLY_PLAN] Error:', error);
      console.error('[WEEKLY_PLAN] Error stack:', error.stack);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/horoscope/monthly-plan", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { month_iso } = req.body;
      const locale = req.body.locale || 'ru';

      console.log('[MONTHLY_PLAN] User ID:', userId);
      console.log('[MONTHLY_PLAN] Request body:', { month_iso, locale });

      const user = await storage.getUser(userId);
      if (!user) {
        console.log('[MONTHLY_PLAN] User not found');
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      // Check if natal chart exists in database
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart || !natalChart.data) {
        console.log('[MONTHLY_PLAN] Natal chart not initialized');
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }

      console.log('[MONTHLY_PLAN] Natal chart exists');

      // Calculate month start (always first day of current month)
      let monthStart = month_iso;
      if (!monthStart) {
        const now = dayjs().tz(user.timezone);
        monthStart = now.startOf('month').format('YYYY-MM-DD');
      }

      // Calculate month end (last day of the month)
      const monthEnd = dayjs(monthStart).endOf('month').format('YYYY-MM-DD');

      console.log('[MONTHLY_PLAN] Month range:', monthStart, 'to', monthEnd);

      // Calculate transits for the start of the month
      const monthStartDate = dayjs(monthStart).tz(user.timezone);
      const transitData = {
        year: monthStartDate.year(),
        month: monthStartDate.month() + 1,
        day: monthStartDate.date(),
        hour: 12, // Noon on first day
        minute: 0,
      };

      console.log('[MONTHLY_PLAN] Calculating transits for:', transitData);
      const transits = await calculateTransits(transitData);
      console.log('[MONTHLY_PLAN] Transits calculated:', Object.keys(transits.planets).length, 'planets');

      // Map transits to natal houses
      const transitsInNatalHouses = mapTransitsToNatalHouses(transits, natalChart.data);
      console.log('[MONTHLY_PLAN] Transits mapped to natal houses');

      // Generate monthly plan
      console.log('[MONTHLY_PLAN] Calling generateMonthlyPlan...');
      const result = await generateMonthlyPlan({
        profile: {
          name: user.name,
          gender: user.gender,
          timezone: user.timezone
        },
        natal: natalChart.data,
        month_iso: monthStart,
        transits: transitsInNatalHouses
      }, locale);

      console.log('[MONTHLY_PLAN] Result received:', JSON.stringify(result).substring(0, 200));

      // AI now generates week_start_iso and week_end_iso for each week directly
      // No need to calculate dates here - they come from the prompt response

      // Save monthly plan to database with date range
      await storage.createHoroscopeReading({
        userId,
        period: 'month',
        startDate: monthStart,
        endDate: monthEnd,
        forecast: JSON.stringify(result),
        data: result,
      });

      // Deduct stars after successful execution
      const monthlyDeductResult = await deductEnergy(storage, userId, 'monthly_plan');
      if (!monthlyDeductResult.ok) {
        console.log('[MONTHLY_PLAN] Failed to deduct stars:', monthlyDeductResult.error);
      } else {
        console.log('[MONTHLY_PLAN] Stars deducted successfully');
      }

      res.json({
        ok: true,
        data: result
      });
    } catch (error: any) {
      console.error('[MONTHLY_PLAN] Error:', error);
      console.error('[MONTHLY_PLAN] Error stack:', error.stack);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Get archive of saved horoscope plans
  app.get("/api/astrology/horoscope/archive", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      
      // Get all saved horoscope readings (weekly and monthly plans)
      const readings = await storage.getHoroscopeReadingsByUserId(userId, 100);
      
      // Filter only weekly and monthly plans
      const archive = readings
        .filter(r => r.period === 'week' || r.period === 'month')
        .map(r => ({
          id: r.id,
          period: r.period,
          startDate: r.startDate,
          endDate: r.endDate,
          data: r.data,
          createdAt: r.createdAt,
        }));
      
      res.json({
        ok: true,
        data: archive
      });
    } catch (error: any) {
      console.error('[ARCHIVE] Error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Delete a saved horoscope plan
  app.delete("/api/astrology/horoscope/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      
      // First check if the reading belongs to the user
      const reading = await storage.getHoroscopeReadingsByUserId(userId, 100);
      const userReading = reading.find(r => r.id === id);
      
      if (!userReading) {
        return res.status(404).json({ ok: false, error: "Reading not found" });
      }
      
      // Delete the reading
      await storage.deleteHoroscopeReading(id);
      
      res.json({
        ok: true,
        message: "Reading deleted successfully"
      });
    } catch (error: any) {
      console.error('[DELETE_READING] Error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/compatibility", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { partner, professional = false, relationshipType = 'romantic', guestChartId } = req.body;
      const locale = req.body.locale || 'en';

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      // Check if we need to create a new guest chart or use existing one
      let finalGuestChartId = guestChartId;
      let needsNewGuestChart = false;
      
      if (!guestChartId) {
        // Check if a guest chart with the same birth data already exists
        const existingGuestCharts = await storage.getExternalNatalsByOwnerId(userId);
        const matchingChart = existingGuestCharts.find((chart: any) => {
          const chartDate = typeof chart.birthdayDate === 'string' 
            ? chart.birthdayDate.split('T')[0] 
            : chart.birthdayDate.toISOString().split('T')[0];
          const partnerDate = partner.date.split('T')[0];
          return chartDate === partnerDate && 
                 chart.birthTime === (partner.time || null) &&
                 chart.name === partner.name;
        });

        if (matchingChart) {
          finalGuestChartId = matchingChart.id;
        } else {
          needsNewGuestChart = true;
        }
      }

      // Execute the reading using Swiss Ephemeris for both charts
      // User's chart (use cached if available, or calculate from profile data)
      let person1ChartData: NatalChartResult;
      const natalChart = await storage.getNatalChart(userId);
      if (natalChart && natalChart.data) {
        person1ChartData = natalChart.data as NatalChartResult;
      } else {
        // Parse date and time with timezone conversion
        const birthdayStr = typeof user.birthdayDate === 'string' ? user.birthdayDate : user.birthdayDate.toISOString();
        const [datePart] = birthdayStr.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        
        const [localHours = 12, localMinutes = 0] = (user.birthTime || '12:00').split(':').map(Number);
        
        // Geocode birth city to get coordinates
        const coords = await geocodeCityWithFallback(user.birthPlace);
        
        // Convert local time to UTC for Swiss Ephemeris
        const userTimezone = user.timezone || 'UTC';
        const localDateTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}:00`;
        const localDateTime = dayjs.tz(localDateTimeStr, userTimezone);
        const utcDateTime = localDateTime.utc();
        
        person1ChartData = await calculateNatalChartPython({
          year: utcDateTime.year(),
          month: utcDateTime.month() + 1,
          day: utcDateTime.date(),
          hour: utcDateTime.hour(),
          minute: utcDateTime.minute(),
          latitude: coords.lat,
          longitude: coords.lon,
          house_system: 'Placidus',
        });
      }

      // Partner's chart - use saved data if exists, otherwise calculate fresh
      let person2ChartData: NatalChartResult;
      
      if (finalGuestChartId && !needsNewGuestChart) {
        // Use existing guest chart data
        const existingChart = await storage.getExternalNatal(finalGuestChartId);
        if (!existingChart || !existingChart.data) {
          return res.status(404).json({ ok: false, error: "Guest chart data not found" });
        }
        person2ChartData = existingChart.data as NatalChartResult;
        console.log('Using existing guest chart data for:', existingChart.name);
      } else {
        // Calculate fresh chart for new guest
        const partnerDateStr = partner.date;
        const [partnerDatePart] = partnerDateStr.split('T');
        const [partnerYear, partnerMonth, partnerDay] = partnerDatePart.split('-').map(Number);
        
        const [partnerLocalHours = 12, partnerLocalMinutes = 0] = (partner.time || '12:00').split(':').map(Number);
        
        // Geocode partner's birth city to get coordinates
        const partnerCoords = await geocodeCityWithFallback(partner.place);
        
        // Auto-resolve timezone from partner's birth place
        const partnerTimezone = await getTimezoneFromCity(partner.place);
        const partnerLocalDateTimeStr = `${partnerYear}-${String(partnerMonth).padStart(2, '0')}-${String(partnerDay).padStart(2, '0')} ${String(partnerLocalHours).padStart(2, '0')}:${String(partnerLocalMinutes).padStart(2, '0')}:00`;
        const partnerLocalDateTime = dayjs.tz(partnerLocalDateTimeStr, partnerTimezone);
        const partnerUtcDateTime = partnerLocalDateTime.utc();
        
        person2ChartData = await calculateNatalChartPython({
          year: partnerUtcDateTime.year(),
          month: partnerUtcDateTime.month() + 1,
          day: partnerUtcDateTime.date(),
          hour: partnerUtcDateTime.hour(),
          minute: partnerUtcDateTime.minute(),
          latitude: partnerCoords.lat,
          longitude: partnerCoords.lon,
          house_system: 'Placidus',
        });

        const newGuestChart = await storage.createExternalNatal({
          ownerId: userId,
          name: partner.name,
          gender: partner.gender || 'other',
          birthdayDate: new Date(partner.date),
          birthTime: partner.time || null,
          birthPlace: partner.place || null,
          timezone: partnerTimezone,
          data: person2ChartData as any,
        });
        finalGuestChartId = newGuestChart.id;
        console.log('Created new guest chart for:', partner.name);
      }

      // Transform for AI interpretation (convert to array format expected by AI)
      const person1Chart = {
        planets: Object.entries(person1ChartData.planets).map(([name, data]) => ({
          name,
          sign: data.sign,
          position: data.longitude,
        })),
        houses: person1ChartData.houses,
        angles: person1ChartData.angles,
        aspects: [], // Aspects calculated by Python
      };

      const person2Chart = {
        planets: Object.entries(person2ChartData.planets).map(([name, data]) => ({
          name,
          sign: data.sign,
          position: data.longitude,
        })),
        houses: person2ChartData.houses,
        angles: person2ChartData.angles,
        aspects: [],
      };

      console.log('Person 1 chart planets:', person1Chart.planets.length);
      console.log('Person 2 chart planets:', person2Chart.planets.length);

      let analysis: string;
      let professionalInterpretation = null;
      let houseOverlays = null;

      if (professional) {
        try {
          // Professional synastry with house overlays
          const { calculateHouseOverlays } = await import("./lib/natalService");
          houseOverlays = calculateHouseOverlays(person2ChartData.planets, person1ChartData.houses);

          const { getProfessionalCompatibilityInterpretation } = await import("./lib/openai");
          const compatibilityData = {
            person1: {
              planets: person1ChartData.planets,
              houses: person1ChartData.houses,
              angles: person1ChartData.angles,
            },
            person2: {
              planets: person2ChartData.planets,
              houses: person2ChartData.houses,
              angles: person2ChartData.angles,
            },
            houseOverlays,
            host_name: user.name,
            partner_name: partner.name,
          };

          professionalInterpretation = await getProfessionalCompatibilityInterpretation(compatibilityData, locale);
          analysis = professionalInterpretation.summary || "Professional compatibility analysis";
        } catch (error: any) {
          console.error('Failed to generate professional compatibility:', error);
          // Fall back to basic compatibility on error (no energy deducted yet)
          analysis = await getAstrologyInterpretation("compatibility", {
            host_name: user.name,
            partner_name: partner.name,
            person1: person1Chart,
            person2: person2Chart,
          }, locale, user.gender);
        }
      } else {
        // Basic compatibility interpretation
        analysis = await getAstrologyInterpretation("compatibility", {
          host_name: user.name,
          host_gender: user.gender,
          partner_name: partner.name,
          partner_gender: partner.gender || 'other',
          relationship_type: relationshipType,
          person1: person1Chart,
          person2: person2Chart,
        }, locale, user.gender);
      }

      // Extract compatibility rating from AI response
      let compatibilityRating: string | null = null;
      let cleanedAnalysis = analysis;
      
      const ratingMatch = analysis.match(/RATING:\s*(\d+\.?\d*)/i);
      if (ratingMatch) {
        compatibilityRating = parseFloat(ratingMatch[1]).toFixed(2);
        // Remove the rating line from the analysis text
        cleanedAnalysis = analysis.replace(/RATING:\s*\d+\.?\d*\s*/i, '').trim();
      }

      await storage.createCompatibilityReading({
        userId,
        partnerName: partner.name,
        partnerGender: partner.gender || 'other',
        partnerDate: new Date(partner.date),
        relationshipType: relationshipType,
        guestChartId: finalGuestChartId || null,
        analysis: cleanedAnalysis,
        compatibilityRating,
        isProfessional: professional,
        professionalInterpretation: professionalInterpretation as any,
        houseOverlays: houseOverlays as any,
      });

      // Deduct stars after successful execution
      const compatFeatureName = professional ? "compatibility_professional" : "compatibility";
      const compatDeductResult = await deductEnergy(storage, userId, compatFeatureName);
      if (!compatDeductResult.ok) {
        console.log('[COMPATIBILITY] Failed to deduct stars:', compatDeductResult.error);
      }

      const strengths = locale === 'ru' ? [
        "Сильная эмоциональная связь и понимание",
        "Общие ценности и жизненные цели",
        "Отличная коммуникация и доверие",
      ] : [
        "Strong emotional connection and understanding",
        "Shared values and life goals",
        "Excellent communication and trust",
      ];

      const challenges = locale === 'ru' ? [
        "Разные подходы к разрешению конфликтов",
        "Баланс между независимостью и близостью",
      ] : [
        "Different approaches to conflict resolution",
        "Balance independence with togetherness",
      ];

      res.json({
        ok: true,
        data: {
          partners: `${user.name} & ${partner.name}`,
          analysis: cleanedAnalysis,
          compatibilityRating: compatibilityRating ? parseFloat(compatibilityRating) : null,
          professionalInterpretation,
          houseOverlays,
          strengths,
          challenges,
        },
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/ask", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { question } = req.body;
      const locale = req.body.locale || 'en';

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      // Check if natal chart exists in database (foundation for personalized answers)
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart || !natalChart.data) {
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }

      // Execute the reading using full natal chart data as foundation
      const answer = await getAstrologyInterpretation("ask", { 
        chart: natalChart.data, 
        question 
      }, locale, user.gender);

      await storage.createAiQuestion({
        userId,
        question,
        answer,
      });

      // Deduct stars after successful execution
      const askDeductResult = await deductEnergy(storage, userId, 'ask');
      if (!askDeductResult.ok) {
        console.log('[ASK] Failed to deduct stars:', askDeductResult.error);
      }

      res.json({ ok: true, data: { answer } });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/astrology/natal/history", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const readings = await storage.getNatalReadingsByUserId(userId, limit);
      res.json({ ok: true, data: readings });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/compatibility/history", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Auto-cleanup: delete compatibility readings older than 2 weeks
      await storage.deleteOldCompatibilityReadings(userId);
      
      const readings = await storage.getCompatibilityReadingsByUserId(userId, limit);
      res.json({ ok: true, data: readings });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/compatibility/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      
      const reading = await storage.getCompatibilityReading(id);
      if (!reading) {
        return res.status(404).json({ ok: false, error: "Compatibility reading not found" });
      }
      
      // Verify ownership
      if (reading.userId !== userId) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }
      
      res.json({ ok: true, data: reading });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.delete("/api/compatibility/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      
      // Verify ownership before deleting
      const reading = await storage.getCompatibilityReading(id);
      if (!reading) {
        return res.status(404).json({ ok: false, error: "Compatibility reading not found" });
      }
      
      if (reading.userId !== userId) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }
      
      await storage.deleteCompatibilityReading(id);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/astrology/horoscope/history", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const readings = await storage.getHoroscopeReadingsByUserId(userId, limit);
      res.json({ ok: true, data: readings });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/astrology/compatibility/history", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const readings = await storage.getCompatibilityReadingsByUserId(userId, limit);
      res.json({ ok: true, data: readings });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/astrology/ask/history", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const questions = await storage.getAiQuestionsByUserId(userId, limit);
      res.json({ ok: true, data: questions });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Important Dates endpoints
  app.get("/api/astrology/important-dates", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const daysForward = parseInt(req.query.days as string) || 60;
      const externalChartId = req.query.externalChartId as string | undefined;
      
      let natalChart;
      
      // If externalChartId is provided, use guest chart; otherwise use user's chart
      if (externalChartId) {
        natalChart = await storage.getExternalNatal(externalChartId);
        if (!natalChart) {
          return res.status(404).json({ ok: false, error: "External natal chart not found" });
        }
        // Verify ownership
        if (natalChart.ownerId !== userId) {
          return res.status(403).json({ ok: false, error: "Forbidden" });
        }
      } else {
        natalChart = await storage.getNatalChart(userId);
        if (!natalChart) {
          return res.status(400).json({ ok: false, error: "Natal chart required. Please create your natal chart first." });
        }
      }
      
      const chartData = natalChart.data as NatalChartResult;
      
      // Извлекаем солнечный знак и асцендент из натальной карты
      const sunSign = chartData.planets?.Sun?.sign;
      const ascendantSign = chartData.angles?.Ascendant?.sign;
      
      console.log(`[Important Dates] ${externalChartId ? 'External chart' : 'User chart'} - Sun sign: ${sunSign}, Ascendant: ${ascendantSign}`);
      
      // Получаем важные даты с лунными фазами и транзитами планет
      const result = await getImportantDatesWithLunarPhases(
        {
          start_date: new Date().toISOString().split('T')[0],  // Сегодня
          days_forward: daysForward
        },
        sunSign,
        ascendantSign
      );
      
      // Возвращаем только массив событий для совместимости с frontend
      res.json({ ok: true, data: result.events });
    } catch (error: any) {
      console.error('[Important Dates] Error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/important-dates/interpret", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { eventType, date, sign: providedSign, planet, to_sign, house_for_sun_sign, locale = 'ru' } = req.body;
      
      console.log('[Important Date Interpretation] Request body:', req.body);
      
      // For planet transits, use to_sign as the sign (the sign the planet is entering)
      const sign = eventType === 'planet_transit' ? to_sign : providedSign;
      
      console.log('[Important Date Interpretation] Parsed fields:', { eventType, date, sign, planet, to_sign, house_for_sun_sign, locale });
      
      if (!eventType || !date || !sign) {
        console.error('[Important Date Interpretation] Missing required fields:', { eventType, date, sign });
        return res.status(400).json({ ok: false, error: "Missing required event data" });
      }
      
      // Check cache first (with 7-day TTL)
      const cachedInterpretation = await storage.getImportantDateInterpretation(
        userId,
        eventType,
        date,
        sign,
        locale
      );
      
      if (cachedInterpretation) {
        console.log('[Important Date Interpretation] Found in cache, returning free');
        return res.json({ 
          ok: true, 
          data: { 
            interpretation: cachedInterpretation.interpretation,
            cost: 0,
            cached: true
          } 
        });
      }
      
      // Not in cache, need to generate new interpretation
      console.log('[Important Date Interpretation] Not in cache, generating new');
      
      // Get user data
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      
      // Get natal chart to extract Sun sign and Ascendant
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart) {
        return res.status(400).json({ ok: false, error: "Natal chart required. Please create your natal chart first." });
      }
      
      const chartData = natalChart.data as NatalChartResult;
      const sunSign = chartData.planets?.Sun?.sign;
      const ascendantSign = chartData.angles?.Ascendant?.sign;
      
      if (!sunSign) {
        return res.status(400).json({ ok: false, error: "Could not determine Sun sign from natal chart" });
      }
      
      // Generate AI interpretation
      const interpretation = await getImportantDateInterpretation(
        eventType,
        {
          date,
          sign,
          planet,
          to_sign,
          house_for_sun_sign
        },
        {
          name: user.name || undefined,
          sunSign,
          ascendantSign,
          gender: user.gender
        },
        locale
      );
      
      // Deduct energy ONLY after successful generation
      await deductEnergy(storage, userId, 'important_date');
      
      // Save to cache for 7 days
      await storage.saveImportantDateInterpretation(
        userId,
        eventType,
        date,
        sign,
        locale,
        interpretation
      );
      
      console.log('[Important Date Interpretation] Generated and cached new interpretation');
      
      res.json({ 
        ok: true, 
        data: { 
          interpretation,
          cost: 2,
          cached: false
        } 
      });
    } catch (error: any) {
      console.error('[Important Date Interpretation] Error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/payments/history", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      
      // Get TON payments
      const tonPayments = await storage.getPaymentsByUserId(userId);
      
      // Get YooKassa payments
      let yookassaPayments = await storage.getYookassaPaymentsByUserId(userId);

      // Ленивая синхронизация: платёж, брошенный на странице ЮKassa, у нас навсегда «pending».
      // Для pending старше 3 минут спрашиваем ЮKassa: canceled → canceled, succeeded → активируем.
      const STALE_MS = 3 * 60 * 1000;
      const ABANDON_MS = 15 * 60 * 1000;
      const stale = yookassaPayments.filter(
        (p) => p.status === 'pending' && p.yookassaPaymentId && Date.now() - new Date(p.createdAt as any).getTime() > STALE_MS
      );
      if (stale.length > 0) {
        for (const p of stale.slice(0, 5)) {
          try {
            const yk = await getYooKassaPayment(p.yookassaPaymentId!);
            const ageMs = Date.now() - new Date(p.createdAt as any).getTime();
            console.log(`[HISTORY] yookassa sync ${p.id}: yk=${yk.status} paid=${yk.paid} age=${Math.round(ageMs / 60000)}m`);
            if (yk.status === 'succeeded' && yk.paid) {
              await activateSucceededYookassaPayment(p, yk, storage);
            } else if (yk.status === 'canceled' || (yk.status === 'pending' && ageMs > ABANDON_MS)) {
              // canceled — отменён ЮKassa; pending старше 15 мин — пользователь ушёл со страницы оплаты
              await storage.updateYookassaPayment(p.id, { status: 'canceled' });
            }
          } catch (syncErr) {
            console.error('[HISTORY] yookassa sync failed (non-blocking):', p.id, syncErr);
          }
        }
        yookassaPayments = await storage.getYookassaPaymentsByUserId(userId);
      }
      
      // Transform YooKassa payments to unified format
      const yookassaFormatted = yookassaPayments.map(p => ({
        id: p.id,
        userId: p.userId,
        kind: p.kind,
        energyAmount: p.energyAmount,
        tier: p.tier,
        amountRUB: p.amountRUB,
        amountTON: null,
        userWalletAddress: null,
        status: p.status,
        txHash: null,
        yookassaPaymentId: p.yookassaPaymentId,
        paymentMethod: 'yookassa' as const,
        createdAt: p.createdAt,
      }));
      
      // Transform TON payments to unified format
      const tonFormatted = tonPayments.map(p => ({
        id: p.id,
        userId: p.userId,
        kind: p.kind,
        energyAmount: p.energyAmount,
        tier: p.tier,
        amountRUB: null,
        amountTON: p.amountTON,
        userWalletAddress: p.userWalletAddress,
        status: p.status,
        txHash: p.txHash,
        yookassaPaymentId: null,
        paymentMethod: 'ton' as const,
        createdAt: p.createdAt,
      }));
      
      // Telegram Stars: берём из журнала событий (successful_payment), без отдельной таблицы
      let starsFormatted: any[] = [];
      try {
        const { paymentEventLog } = await import("../shared/schema");
        const { sql: dsql } = await import("drizzle-orm");
        const rows = await db
          .select()
          .from(paymentEventLog)
          .where(dsql`${paymentEventLog.provider} = 'stars' AND ${paymentEventLog.payload}->'message'->'successful_payment'->>'invoice_payload' LIKE ${'%"u":"' + userId + '"%'}`);
        starsFormatted = rows.map((r: any) => {
          const sp = r.payload?.message?.successful_payment || {};
          let inv: any = {};
          try { inv = JSON.parse(sp.invoice_payload || '{}'); } catch { /* noop */ }
          return {
            id: `stars_${r.eventId}`,
            userId,
            kind: 'energy_pack',
            energyAmount: Number(inv.o) || null,
            tier: null,
            amountRUB: null,
            amountTON: null,
            amountStars: Number(sp.total_amount) || null,
            userWalletAddress: null,
            status: 'completed',
            txHash: null,
            yookassaPaymentId: null,
            paymentMethod: 'stars' as const,
            createdAt: r.createdAt,
          };
        });
      } catch (starsErr) {
        console.error('[HISTORY] stars lookup failed (non-blocking):', starsErr);
      }

      // Combine and sort by createdAt (newest first)
      const allPayments = [...tonFormatted, ...yookassaFormatted, ...starsFormatted].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      res.json({ ok: true, data: allPayments });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Manual check for ALL pending payments
  app.post("/api/payments/ton/check-pending", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      
      // Get all pending TON payments for this user
      const allPayments = await storage.getAllPayments();
      const pendingPayments = allPayments.filter(
        p => p.userId === userId && p.status === 'pending' && p.kind === 'energy_pack'
      );

      if (pendingPayments.length === 0) {
        return res.json({ ok: true, data: { found: 0, creditedEnergy: 0, message: 'No pending payments' } });
      }

      console.log(`[CHECK_PENDING] Found ${pendingPayments.length} pending payments for user ${userId}`);

      const walletAddress = process.env.TON_WALLET_ADDRESS;
      if (!walletAddress) {
        return res.status(500).json({ ok: false, error: 'Payment system not configured' });
      }

      let foundCount = 0;
      let creditedEnergy = 0;

      // Try to find transactions for each pending payment
      for (const payment of pendingPayments) {
        if (!payment.userWalletAddress) {
          console.log('[CHECK_PENDING] Skipping payment without user wallet address:', payment.id);
          continue;
        }

        const amountInNanoTON = (parseFloat(payment.amountTON || '0') * 1_000_000_000).toFixed(0);
        
        const { findUserTransaction } = await import('./lib/ton.js');
        const matchedTx = await findUserTransaction(
          payment.userWalletAddress,
          walletAddress,
          amountInNanoTON,
          60, // Check last 60 minutes (very generous)
          new Set()
        );

        if (matchedTx) {
          foundCount++;
          
          // Credit energy
          if (payment.energyAmount) {
            await creditPurchasedOrbs(storage, userId, payment.energyAmount, 'ton');
            creditedEnergy += payment.energyAmount;
          }

          // Mark as completed
          await storage.updatePayment(payment.id, {
            status: 'completed',
            txHash: matchedTx.hash,
          });

          console.log('[CHECK_PENDING] ✅ Found and credited payment:', payment.id);
        }
      }

      res.json({
        ok: true,
        data: {
          found: foundCount,
          creditedEnergy,
          message: `Checked ${pendingPayments.length} payments, found ${foundCount}`,
        },
        });
    } catch (error: any) {
      console.error('[CHECK_PENDING] Error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/referral/code", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Get all referral rewards for this user
      const rewards = await storage.getReferralRewardsByReferrerId(user.id);
      
      // Fetch user details for each referred user
      const referralsWithDetails = await Promise.all(
        rewards.map(async (reward) => {
          const referredUser = await storage.getUser(reward.referredUserId);
          return {
            id: reward.id,
            userName: referredUser?.name || 'Unknown',
            rewardType: reward.rewardType,
            rewardKind: reward.rewardKind,
            energyAmount: reward.energyAmount,
            subscriptionDays: reward.subscriptionDays,
            createdAt: reward.createdAt,
          };
        })
      );

      // Pending choices: free referrer must pick Standard (7d) or Premium (3d)
      const pendingChoices = referralsWithDetails.filter(r => r.rewardKind === 'pending_choice');

      res.json({
        ok: true,
        data: {
          referralCode: user.referralCode,
          referrals: referralsWithDetails,
          pendingChoices,
          totalRewards: rewards.reduce((sum, r) => sum + r.energyAmount, 0),
          totalReferrals: rewards.filter(r => r.rewardType === 'signup').length,
        },
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Claim a pending referral choice reward (free referrer: Standard 7d OR Premium 3d)
  app.post("/api/referral/claim-choice", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { rewardId, choice } = req.body;

      if (!rewardId || !['standard', 'premium'].includes(choice)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid request. Provide rewardId and choice ("standard" or "premium")',
        });
      }

      const result = await claimReferralChoice(storage, user.id, rewardId, choice);

      res.json({ ok: true, data: result });
    } catch (error: any) {
      const message = error.message || 'Failed to claim reward';
      const status = message.includes('already been claimed') ? 409
        : message.includes('not found') ? 404
        : message.includes('does not belong') ? 403
        : 500;
      res.status(status).json({ ok: false, error: message });
    }
  });

  // Validate referral code (check if code exists and is valid)
  app.get("/api/referral/validate/:code", async (req, res) => {
    try {
      const { code } = req.params;
      
      if (!code || code.trim() === '') {
        return res.json({
          ok: true,
          data: {
            valid: false,
            referrer: null,
          },
        });
      }

      const referrer = await storage.getUserByReferralCode(code.trim());
      
      if (!referrer) {
        return res.json({
          ok: true,
          data: {
            valid: false,
            referrer: null,
          },
        });
      }

      // Code is valid - return referrer info (without sensitive data)
      res.json({
        ok: true,
        data: {
          valid: true,
          referrer: {
            name: referrer.name,
            username: referrer.username || null,
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/payments/price", async (req, res) => {
    try {
      const tonRate = await getTonPrice();

      res.json({
        ok: true,
        data: {
          tonRate,
          subscriptions: {
            standard: { usd: 9, ton: (9 / tonRate).toFixed(2), stars: 565 },
            pro: { usd: 15, ton: (15 / tonRate).toFixed(2), stars: 940 },
          },
          energyPacks: {
            small: { amount: 20, usd: 2.99, ton: (2.99 / tonRate).toFixed(2), stars: 190 },
            medium: { amount: 50, usd: 5.99, ton: (5.99 / tonRate).toFixed(2), stars: 375 },
            large: { amount: 120, usd: 11.99, ton: (11.99 / tonRate).toFixed(2), stars: 750 },
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  const createPaymentSchema = z.object({
    kind: z.enum(["energy_pack", "subscription"]),
    tier: z.enum(["standard", "pro", "premium"]).optional(),
    energyAmount: z.number().optional(),
    amountUSD: z.number().optional().default(0), // цена считается на сервере
    months: z.number().optional(),
    mode: z.enum(["new", "renew", "upgrade"]).optional(),
    userWalletAddress: z.string().optional(), // TON wallet address of sender
  });

  app.post("/api/payments/ton/create", requireAuth, async (req, res) => {
    const fs = await import('fs');
    const logData = `\n\n[${new Date().toISOString()}] TON_CREATE REQUEST\nUserID: ${(req as any).userId}\nBody: ${JSON.stringify(req.body, null, 2)}\n`;
    fs.appendFileSync('/tmp/ton-debug.log', logData);
    
    console.log('=====================================');
    console.log('[TON_CREATE] Request received:', { userId: (req as any).userId, body: req.body });
    console.log('=====================================');
    try {
      const userId = (req as any).userId;
      const validated = createPaymentSchema.parse(req.body);

      // Паки звёзд: цена берётся с сервера (shared/orbPacks), клиентский amountUSD игнорируется
      let subMonths: PeriodMonths = 1;
      let subMode: 'new' | 'renew' | 'upgrade' = 'new';
      if (validated.kind === "energy_pack") {
        const orbPack = getOrbPackByOrbs(validated.energyAmount);
        if (!orbPack) {
          return res.status(400).json({ ok: false, error: "Invalid energy pack" });
        }
        validated.amountUSD = orbPack.usd;
      } else {
        // Подписка: цена в ₽ из shared/subscriptionPrices → USD по курсу ЦБ (клиентский amountUSD не используется)
        if (!validated.tier) return res.status(400).json({ ok: false, error: "tier required" });
        if (![1, 6, 12].includes(validated.months || 1)) return res.status(400).json({ ok: false, error: "invalid_period" });
        subMonths = (validated.months || 1) as PeriodMonths;
        subMode = validated.mode || 'new';
        const paidTier = normalizePaidTier(validated.tier);
        const sub = await storage.getSubscription(userId);
        const subActive = !!sub && sub.status === 'active' && new Date(sub.currentPeriodEnd) > new Date();
        let rub = 0;
        if (subMode === 'renew') {
          if (!subActive) return res.status(400).json({ ok: false, error: "no_active_subscription" });
          rub = subscriptionRub(normalizePaidTier(sub!.tier), subMonths);
        } else if (subMode === 'upgrade') {
          if (!subActive || sub!.tier !== 'standard') return res.status(400).json({ ok: false, error: "no_standard_to_upgrade" });
          const remainingDays = Math.ceil(Math.max(0, new Date(sub!.currentPeriodEnd).getTime() - Date.now()) / 86400000);
          rub = upgradeRub(remainingDays) + (subMonths > 1 ? subscriptionRub('premium', subMonths) : 0);
        } else {
          rub = subscriptionRub(paidTier, subMonths);
        }
        const { getUsdRubRate } = await import('./lib/exchangeRates');
        const usdRub = (await getUsdRubRate()).rate;
        validated.amountUSD = Math.round((rub / usdRub) * 100) / 100;
      }

      if (!process.env.TON_WALLET_ADDRESS) {
        return res.status(500).json({ 
          ok: false, 
          error: "Payment system not configured. Please contact support." 
        });
      }

      // Get TON price and convert USD to TON.
      // If the rate is unavailable or conversion produces an invalid amount, return 400
      // so the client surfaces a clear "try again" message instead of an invalid payload.
      let amountTON: string;
      let tonPrice: number;
      try {
        tonPrice = await getTonPrice();
        amountTON = convertUSDToTON(validated.amountUSD, tonPrice);
      } catch (conversionError: any) {
        console.error('[TON_CREATE] Conversion failed:', conversionError?.message);
        return res.status(400).json({
          ok: false,
          error: "TON exchange rate is temporarily unavailable. Please try again in a minute.",
        });
      }

      // Normalize user wallet address to raw format (0:...) for consistent comparison
      const normalizedUserAddress = validated.userWalletAddress 
        ? normalizeTonAddress(validated.userWalletAddress)
        : null;

      console.log('[TON_CREATE] Payment details:', {
        tonPrice,
        amountUSD: validated.amountUSD,
        amountTON,
        userAddress: normalizedUserAddress
      });
      
      const normalizedPaymentTier = validated.tier ? ((validated.tier === 'premium' || validated.tier === 'pro') ? 'pro' : 'standard') : null;
      const payment = await storage.createPayment({
        userId,
        kind: validated.kind,
        tier: normalizedPaymentTier,
        energyAmount: validated.energyAmount || null,
        periodMonths: validated.kind === 'subscription' ? subMonths : null,
        mode: validated.kind === 'subscription' ? subMode : null,
        amountUSD: validated.amountUSD.toString(),
        amountTON: (parseFloat(amountTON) / 1_000_000_000).toString(),
        txHash: `pending_${Date.now()}`,
        status: "pending",
        userWalletAddress: normalizedUserAddress,
      });

      res.json({
        ok: true,
        data: {
          paymentId: payment.id,
          walletAddress: process.env.TON_WALLET_ADDRESS,
          amountTON,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ ok: false, error: error.errors[0].message });
      }
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  const confirmTonPaymentSchema = z.object({
    paymentId: z.string(),
    boc: z.string().optional(), // BOC not used, backend searches by amount/time
  });

  app.post("/api/payments/ton/confirm", requireAuth, async (req, res) => {
    console.log('=====================================');
    console.log('[TON_CONFIRM] Request received:', { userId: (req as any).userId, body: req.body });
    console.log('=====================================');
    try {
      const userId = (req as any).userId;
      const validated = confirmTonPaymentSchema.parse(req.body);

      // Find payment
      const payments = await storage.getAllPayments();
      const payment = payments.find(p => p.id === validated.paymentId && p.userId === userId);

      if (!payment) {
        return res.status(404).json({ ok: false, error: "Payment not found" });
      }

      if (payment.status === "completed") {
        // Already processed (idempotency)
        console.log('[TON_CONFIRM] Payment already completed:', validated.paymentId);
        return res.json({ 
          ok: true, 
          data: {
            status: 'succeeded',
            energyAmount: payment.energyAmount || 0
          }
        });
      }

      // Get wallet address from env
      const walletAddress = process.env.TON_WALLET_ADDRESS;
      if (!walletAddress) {
        console.error('[TON_CONFIRM] TON_WALLET_ADDRESS not configured');
        return res.status(500).json({ ok: false, error: "Payment system not configured" });
      }

      // Get all used txHashes to exclude them from search
      const usedTxHashes = new Set(
        payments
          .filter(p => p.status === "completed" && p.txHash && !p.txHash.startsWith('pending_'))
          .map(p => p.txHash)
      );

      // Convert amount to nanoTON for comparison
      const amountInNanoTON = (parseFloat(payment.amountTON || '0') * 1_000_000_000).toFixed(0);

      // Check if we have user's wallet address
      if (!payment.userWalletAddress) {
        console.error('[TON_CONFIRM] User wallet address not found in payment');
        return res.status(400).json({ 
          ok: false, 
          error: "Payment missing user wallet address. Please try creating a new payment." 
        });
      }

      // Search for transaction FROM user's wallet TO our wallet
      console.log('[TON_CONFIRM] Searching for transaction FROM user wallet TO our wallet');
      console.log('[TON_CONFIRM] User wallet address:', payment.userWalletAddress);
      console.log('[TON_CONFIRM] Our wallet address:', walletAddress);
      console.log('[TON_CONFIRM] Expected amount:', amountInNanoTON, 'nanoTON');
      const matchedTx = await findUserTransaction(
        payment.userWalletAddress,
        walletAddress,
        amountInNanoTON,
        15, // Extended to 15 minutes
        usedTxHashes
      );

      if (!matchedTx) {
        console.log('[TON_CONFIRM] Transaction not found yet - still processing');
        return res.json({ 
          ok: true,
          data: {
            status: 'processing',
            energyAmount: 0
          }
        });
      }

      // Process payment - credit orbs or activate subscription
      if (payment.kind === "energy_pack" && payment.energyAmount) {
        await creditPurchasedOrbs(storage, userId, payment.energyAmount, 'ton');
      } else if (payment.kind === "subscription" && payment.tier) {
        const { applySubscriptionUpgrade, applySubscriptionRenewal } = await import("./lib/paymentActivation");
        const months = payment.periodMonths || 1;
        const rubStr = null;
        if (payment.mode === 'upgrade') {
          await applySubscriptionUpgrade(storage, userId, months, 'ton', { amountRUB: rubStr });
        } else if (payment.mode === 'renew') {
          await applySubscriptionRenewal(storage, userId, months, 'ton', { amountRUB: rubStr });
        } else {
          const cur = await storage.getSubscription(userId);
          const curActive = !!cur && cur.status === 'active' && new Date(cur.currentPeriodEnd) > new Date();
          const rank = (t: string) => (t === 'pro' || t === 'premium' ? 2 : t === 'standard' ? 1 : 0);
          if (curActive && rank(cur!.tier) > rank(payment.tier)) {
            await storage.updateSubscription(cur!.id, {
              scheduledTier: payment.tier, scheduledPeriodMonths: months, scheduledAmountRUB: null, autoRenew: false,
            });
          } else {
            await activateSubscriptionForUser(storage, {
              userId: userId, tier: payment.tier as any, periodMonths: months, source: 'ton', meta: { extend: true },
            });
          }
        }
      }

      // Update payment status with verified txHash
      await storage.updatePayment(validated.paymentId, {
        status: "completed",
        txHash: matchedTx.hash,
      });

      console.log('[TON_CONFIRM] Payment verified and completed:', {
        paymentId: validated.paymentId,
        txHash: matchedTx.hash,
        amount: matchedTx.amount,
      });

      res.json({ 
        ok: true, 
        data: {
          status: 'succeeded',
          kind: payment.kind,
          tier: payment.tier,
          energyAmount: payment.energyAmount || 0,
          txHash: matchedTx.hash
        }
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ ok: false, error: error.errors[0].message });
      }
      console.error('[TON_CONFIRM] Error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allPayments = await storage.getAllPayments();
      const allSubscriptions = await storage.getAllSubscriptions();
      
      const totalRevenue = allPayments
        .filter(p => p.status === "confirmed" || p.status === "completed")
        .reduce((sum, p) => sum + parseFloat(p.amountUSD), 0);

      const activeSubscriptions = allSubscriptions.filter(s => s.status === "active").length;
      
      const stats = {
        totalUsers: allUsers.length,
        totalRevenue: totalRevenue.toFixed(2),
        activeSubscriptions,
        totalPayments: allPayments.length,
        recentUsers: allUsers.slice(0, 10),
      };

      res.json({ ok: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json({ ok: true, data: users });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  const updateEnergySchema = z.object({
    energy: z.number().int().min(0).max(1000),
  });

  app.post("/api/admin/users/:userId/energy", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const validated = updateEnergySchema.parse(req.body);
      
      // Set purchased energy to the specified amount (admin override)
      await storage.updateUser(userId, { purchasedEnergy: validated.energy });
      res.json({ ok: true });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ ok: false, error: error.errors[0].message });
      }
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  const updateSubscriptionSchema = z.object({
    tier: z.enum(["standard", "pro", "premium"]),
    status: z.enum(["active", "canceled", "expired"]),
  });

  app.post("/api/admin/users/:userId/subscription", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const validated = updateSubscriptionSchema.parse(req.body);
      
      const existingSub = await storage.getSubscription(userId);
      const startedAt = new Date();
      const currentPeriodEnd = dayjs(startedAt).add(30, "days").toDate();
      
      if (existingSub) {
        await storage.updateSubscription(existingSub.id, {
          tier: validated.tier,
          status: validated.status,
          currentPeriodEnd,
        });
      } else {
        await storage.createSubscription({
          userId,
          tier: validated.tier,
          status: validated.status,
          startedAt,
          currentPeriodEnd,
        });
      }
      
      res.json({ ok: true });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ ok: false, error: error.errors[0].message });
      }
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/payments/ton/webhook", async (req, res) => {
    try {
      const { txHash, paymentId } = req.body;

      const payment = await storage.getPayment(paymentId);
      if (!payment) {
        return res.status(404).json({ ok: false, error: "Payment not found" });
      }

      if (payment.status === "confirmed") {
        return res.status(400).json({ ok: false, error: "Payment already confirmed" });
      }

      const existingPayment = await storage.getPaymentByTxHash(txHash);
      if (existingPayment && existingPayment.id !== paymentId && existingPayment.status === "confirmed") {
        await storage.updatePayment(paymentId, {
          txHash,
          status: "failed",
        });
        return res.status(400).json({ ok: false, error: "Transaction hash already used" });
      }

      if (!process.env.TON_WALLET_ADDRESS) {
        return res.status(500).json({ ok: false, error: "TON wallet address not configured" });
      }

      const isValid = await verifyTonTransaction(
        txHash,
        (parseFloat(payment.amountTON) * 1_000_000_000).toFixed(0),
        process.env.TON_WALLET_ADDRESS
      );

      if (!isValid) {
        await storage.updatePayment(paymentId, {
          txHash,
          status: "failed",
        });
        return res.status(400).json({ ok: false, error: "Invalid transaction" });
      }

      await storage.updatePayment(paymentId, {
        txHash,
        status: "confirmed",
      });

      if (payment.kind === "energy_pack" && payment.energyAmount) {
        await creditPurchasedOrbs(storage, payment.userId, payment.energyAmount, 'ton');
      } else if (payment.kind === "subscription" && payment.tier) {
        const { applySubscriptionUpgrade, applySubscriptionRenewal } = await import("./lib/paymentActivation");
        const months = payment.periodMonths || 1;
        const rubStr = null;
        if (payment.mode === 'upgrade') {
          await applySubscriptionUpgrade(storage, payment.userId, months, 'ton', { amountRUB: rubStr });
        } else if (payment.mode === 'renew') {
          await applySubscriptionRenewal(storage, payment.userId, months, 'ton', { amountRUB: rubStr });
        } else {
          const cur = await storage.getSubscription(payment.userId);
          const curActive = !!cur && cur.status === 'active' && new Date(cur.currentPeriodEnd) > new Date();
          const rank = (t: string) => (t === 'pro' || t === 'premium' ? 2 : t === 'standard' ? 1 : 0);
          if (curActive && rank(cur!.tier) > rank(payment.tier)) {
            await storage.updateSubscription(cur!.id, {
              scheduledTier: payment.tier, scheduledPeriodMonths: months, scheduledAmountRUB: null, autoRenew: false,
            });
          } else {
            await activateSubscriptionForUser(storage, {
              userId: payment.userId, tier: payment.tier as any, periodMonths: months, source: 'ton', meta: { extend: true },
            });
          }
        }
      }

      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // YooKassa payment endpoints

  const createYooKassaPaymentSchema = z.object({
    kind: z.enum(["energy_pack", "subscription", "subscription_upgrade", "subscription_renewal"]),
    pack: z.object({
      // Легаси: число орбов пака; источник правды — shared/orbPacks.ts
      energy: z.number().refine(val => ORB_PACKS.some(p => p.orbs === val), { message: 'Invalid energy pack' })
    }).optional(),
    tier: z.enum(["standard", "pro", "premium"]).optional(),
    periodMonths: z.number().refine(val => [1, 6, 12].includes(val)).optional(), // Subscription period
    autoRenew: z.boolean().optional(), // Auto-renewal for subscriptions
    customerEmail: z.string().email().optional().nullable(),
    idempotencyKey: z.string().min(1).max(64), // Client-generated idempotency key (required)
  });

  // Upgrade/renewal preview for current subscriber
  app.get("/api/subscription/upgrade-preview", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const sub = await storage.getSubscription(userId);

      if (!sub || sub.status !== 'active') {
        return res.json({ ok: true, data: { canUpgrade: false, canRenew: false } });
      }

      const now = new Date();
      const periodEnd = new Date(sub.currentPeriodEnd);
      const remainingMs = Math.max(0, periodEnd.getTime() - now.getTime());
      const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

      const STANDARD_MONTHLY = 199;
      const PREMIUM_MONTHLY = 399;

      const result: Record<string, any> = {
        canRenew: true,
        canUpgrade: sub.tier === 'standard',
        currentTier: sub.tier,
        remainingDays,
        currentPeriodEnd: sub.currentPeriodEnd,
        renewalPrice: sub.tier === 'standard' ? STANDARD_MONTHLY : PREMIUM_MONTHLY,
      };

      if (sub.tier === 'standard') {
        const dailyDelta = (PREMIUM_MONTHLY - STANDARD_MONTHLY) / 30;
        result.upgradePrice = Math.max(1, Math.ceil(remainingDays * dailyDelta));
        result.upgradeStarsBonus = 300; // 550 - 250
      }

      return res.json({ ok: true, data: result });
    } catch (error: any) {
      console.error('[Upgrade Preview] Error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/payments/yookassa/create", requireAuth, async (req, res) => {
    let yookassaPayment: any = null; // Declare here so it's accessible in catch block
    
    try {
      const userId = (req as any).userId;
      console.log('[YooKassa] ============ NEW PAYMENT REQUEST ============');
      console.log('[YooKassa] User ID:', userId);
      console.log('[YooKassa] Request body:', JSON.stringify(req.body, null, 2));
      
      const validated = createYooKassaPaymentSchema.parse(req.body);
      console.log('[YooKassa] Idempotency Key (FULL):', validated.idempotencyKey);
      console.log('[YooKassa] Payment kind:', validated.kind);
      console.log('[YooKassa] Pack/Tier:', validated.pack || validated.tier);

      // Check if payment with this idempotency key already exists
      const existingPayment = await storage.getYookassaPaymentByIdempotencyKey(validated.idempotencyKey);
      if (existingPayment) {
        console.log('[YooKassa] ⚠️  EXISTING PAYMENT FOUND:');
        console.log('[YooKassa]   - Payment ID:', existingPayment.id);
        console.log('[YooKassa]   - YooKassa ID:', existingPayment.yookassaPaymentId || 'NOT SET');
        console.log('[YooKassa]   - Status:', existingPayment.status);
        console.log('[YooKassa]   - User ID:', existingPayment.userId);
        console.log('[YooKassa]   - Created At:', existingPayment.createdAt);
        console.log('[YooKassa]   - Idempotency Key:', existingPayment.idempotencyKey);
        
        // Verify it belongs to this user (security check)
        if (existingPayment.userId !== userId) {
          console.error('[YooKassa] Idempotency key collision - different user!');
          return res.status(409).json({ 
            ok: false, 
            error: 'Payment already in progress, please try again in a minute' 
          });
        }
        
        // If payment already succeeded or was canceled, don't allow reuse
        if (existingPayment.status !== 'pending') {
          return res.status(400).json({ 
            ok: false, 
            error: `Payment with this idempotency key already ${existingPayment.status}` 
          });
        }
        
        // Payment is pending for this user
        // If it has yookassaPaymentId, fetch and return the confirmation URL
        if (existingPayment.yookassaPaymentId) {
          try {
            const ykPayment = await getYooKassaPayment(existingPayment.yookassaPaymentId);
            const confirmationUrl = ykPayment.confirmation?.confirmation_url;
            
            if (confirmationUrl) {
              console.log('[YooKassa] Returning existing payment:', existingPayment.id);
              return res.json({
                ok: true,
                data: {
                  confirmationUrl,
                  paymentId: existingPayment.id,
                  yookassaPaymentId: existingPayment.yookassaPaymentId,
                },
              });
            }
          } catch (fetchError) {
            console.error('[YooKassa] Failed to fetch existing payment from YooKassa:', fetchError);
            // Fall through to check if we should retry creation
          }
        }
        
        // Payment exists but doesn't have yookassaPaymentId
        // Check if it's been too long since creation (stuck payment from failed API call)
        const createdAt = new Date(existingPayment.createdAt);
        const now = new Date();
        const secondsSinceCreation = (now.getTime() - createdAt.getTime()) / 1000;
        
        if (secondsSinceCreation > 30) {
          // Payment has been pending for >30 seconds without yookassaPaymentId
          // This likely means the original YooKassa API call failed
          // Delete it and allow creation of a new one
          console.log('[YooKassa] Stuck payment detected (>30s), deleting and will retry:', existingPayment.id);
          await storage.deleteYookassaPayment(existingPayment.id);
          // Fall through to create new payment
        } else {
          // Payment was created recently, likely still in progress (race condition)
          // Tell client to retry after a short delay
          console.log('[YooKassa] Recent payment being created, asking client to retry');
          return res.status(202).json({ 
            ok: true,
            status: 'pending',
            retryAfter: 3,
            message: 'Payment is being created, will retry automatically'
          });
        }
      }

      // Determine pricing based on kind and pack/tier (in RUB)
      let description: string;
      let scheduleAfterCurrent = false;
      let scheduledStart: Date | null = null;
      let amountRUB: string;
      let energyAmount: number | undefined;
      let tier: string | undefined;

      if (validated.kind === "energy_pack" && validated.pack) {
        const orbPack = getOrbPackByOrbs(validated.pack.energy);
        if (!orbPack) {
          console.error('[YooKassa] Invalid pack:', validated.pack.energy);
          return res.status(400).json({ ok: false, error: "Invalid energy pack" });
        }

        description = `Покупка ${orbPack.orbs} звёзд Astro Orb`;
        amountRUB = orbPack.rub.toFixed(2);
        energyAmount = orbPack.orbs;
      } else if (validated.kind === "subscription" && validated.tier) {
        const periodMonths = validated.periodMonths || 1;
        const normalizedTier = (validated.tier === 'premium' || validated.tier === 'pro') ? 'premium' : 'standard';

        // Активная подписка выше тиром (Premium → покупка Standard): не понижаем сразу,
        // а планируем старт после окончания текущей. Активация видит metadata.scheduleAfterCurrent.
        const activeSub = await storage.getSubscription(userId);
        const rank = (t: string | null | undefined) => (t === 'pro' || t === 'premium' ? 2 : t === 'standard' ? 1 : 0);
        if (activeSub && activeSub.status === 'active' && new Date(activeSub.currentPeriodEnd) > new Date()
            && rank(activeSub.tier) > rank(normalizedTier)) {
          scheduleAfterCurrent = true;
          scheduledStart = new Date(activeSub.currentPeriodEnd);
        }
        
        const tierPrices = SUBSCRIPTION_PRICES_PER_MONTH[normalizedTier] as Record<number, number>;
        const pricePerMonth = tierPrices[periodMonths as 1 | 6 | 12] || tierPrices[1];
        const totalPrice = pricePerMonth * periodMonths;
        
        let periodLabel = '1 месяц';
        if (periodMonths === 6) periodLabel = '6 месяцев';
        else if (periodMonths === 12) periodLabel = '12 месяцев';
        
        const tierLabel = normalizedTier === 'standard' ? 'Standard (250 звёзд/мес)' : 'Premium (550 звёзд/мес)';
        description = scheduleAfterCurrent && scheduledStart
          ? `Подписка ${tierLabel} на ${periodLabel} (с ${dayjs(scheduledStart).format('DD.MM.YYYY')})`
          : `Подписка ${tierLabel} на ${periodLabel}`;
        amountRUB = totalPrice.toFixed(2);
        tier = normalizedTier === 'premium' ? 'pro' : 'standard';
      } else if (validated.kind === "subscription_upgrade") {
        // Standard → Premium. periodMonths=1: только доплата за оставшиеся дни (срок не меняется).
        // periodMonths=6/12: доплата за оставшиеся дни + N месяцев Premium, срок продлевается от текущей даты окончания.
        const sub = await storage.getSubscription(userId);
        if (!sub || sub.status !== 'active' || sub.tier !== 'standard') {
          return res.status(400).json({ ok: false, error: "No active Standard subscription to upgrade" });
        }
        const periodMonths = validated.periodMonths || 1;
        const remainingMs = Math.max(0, new Date(sub.currentPeriodEnd).getTime() - Date.now());
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        const upgradePrice = upgradeRub(remainingDays);
        if (periodMonths === 1) {
          description = `Апгрейд до Premium (доплата за ${remainingDays} дн.)`;
          amountRUB = upgradePrice.toFixed(2);
        } else {
          const extension = subscriptionRub('premium', periodMonths as PeriodMonths);
          description = `Апгрейд до Premium (доплата за ${remainingDays} дн.) + Premium на ${PERIOD_LABEL_RU[periodMonths as PeriodMonths]}`;
          amountRUB = (upgradePrice + extension).toFixed(2);
        }
        tier = 'pro';
      } else if (validated.kind === "subscription_renewal") {
        // Продление того же тарифа на 1/6/12 месяцев по цене выбранного периода, от текущей даты окончания
        const sub = await storage.getSubscription(userId);
        if (!sub || sub.status !== 'active') {
          return res.status(400).json({ ok: false, error: "No active subscription to renew" });
        }
        const periodMonths = validated.periodMonths || 1;
        const renewalPrice = subscriptionRub(normalizePaidTier(sub.tier), periodMonths as PeriodMonths);
        const tierName = sub.tier === 'standard' ? 'Standard' : 'Premium';
        description = `Продление подписки ${tierName} на ${PERIOD_LABEL_RU[periodMonths as PeriodMonths]}`;
        amountRUB = renewalPrice.toFixed(2);
        tier = sub.tier === 'standard' ? 'standard' : 'pro';
      } else {
        console.error('[YooKassa] Invalid request - missing pack or tier');
        return res.status(400).json({ ok: false, error: "Invalid request: must specify pack or tier" });
      }

      console.log('[YooKassa] Payment config:', { description, amountRUB, energyAmount, tier });

      // Create payment record first
      // Wrap in try/catch to handle race condition where two requests with same idempotencyKey
      // both pass the existingPayment check and both try to create a record
      try {
        yookassaPayment = await storage.createYookassaPayment({
          userId,
          kind: validated.kind,
          tier,
          energyAmount,
          amountRUB,
          yookassaPaymentId: null, // Will be updated after YooKassa creates payment
          idempotencyKey: validated.idempotencyKey, // Store client's idempotency key
        });
        
        console.log('[YooKassa] Payment record created with ID:', yookassaPayment.id);
      } catch (createError: any) {
        // If duplicate key error on idempotencyKey, another request beat us to creating the record
        console.log('[YooKassa] Create error caught:', {
          code: createError.code,
          constraint: createError.constraint,
          message: createError.message
        });
        
        const isDuplicateIdempotencyKey = 
          createError.code === '23505' && 
          (createError.constraint?.includes('idempotency_key') || 
           createError.message?.includes('idempotency_key'));
        
        if (isDuplicateIdempotencyKey) {
          console.warn('[YooKassa] ⚠️  Race condition detected - another request created payment with same idempotency key');
          
          // Fetch the existing payment that was just created
          const existingPaymentByKey = await storage.getYookassaPaymentByIdempotencyKey(validated.idempotencyKey);
          if (existingPaymentByKey) {
            console.log('[YooKassa] Found existing payment:', existingPaymentByKey.id);
            
            // Use the existing payment instead
            yookassaPayment = existingPaymentByKey;
            
            // If it already has a yookassaPaymentId and confirmation URL, return it immediately
            if (existingPaymentByKey.yookassaPaymentId) {
              try {
                const ykPayment = await getYooKassaPayment(existingPaymentByKey.yookassaPaymentId);
                const confirmationUrl = ykPayment.confirmation?.confirmation_url;
                
                if (confirmationUrl) {
                  console.log('[YooKassa] Returning existing payment URL (race condition handled)');
                  return res.json({
                    ok: true,
                    data: {
                      confirmationUrl,
                      paymentId: existingPaymentByKey.id,
                      yookassaPaymentId: existingPaymentByKey.yookassaPaymentId,
                    },
                  });
                }
              } catch (fetchError) {
                console.error('[YooKassa] Failed to fetch existing payment from YooKassa:', fetchError);
                // Fall through to continue creating YooKassa payment
              }
            }
            
            // Payment exists but doesn't have yookassaPaymentId yet
            // Wait a moment for the other request to finish, then tell client to retry
            console.log('[YooKassa] Existing payment being processed by another request, asking client to retry');
            return res.status(202).json({ 
              ok: true,
              status: 'pending',
              retryAfter: 2,
              message: 'Payment is being created, will retry automatically'
            });
          } else {
            // This shouldn't happen - we got duplicate key error but can't find the existing payment
            console.error('[YooKassa] Got duplicate key error but cannot find existing payment!');
            return res.status(500).json({ ok: false, error: 'Payment creation failed, please try again' });
          }
        } else {
          // Different error - re-throw it
          throw createError;
        }
      }

      // Create YooKassa payment
      const baseUrl = process.env.SERVER_URL || `https://${req.headers.host}`;
      // Возврат из ЮKassa — обратно в мини-апп внутри Telegram (t.me/<bot>?startapp=pay_<id>),
      // а не в браузер, где нет сессии
      const { buildMiniAppReturnUrl } = await import("./lib/telegramStars");
      const returnUrl = await buildMiniAppReturnUrl(baseUrl, yookassaPayment.id);

      // Get user for receipt (email required by YooKassa for самозанятый по 54-ФЗ)
      const user = await storage.getUser(userId);
      // Use provided email from frontend, or fallback to synthetic email based on Telegram ID
      const customerEmail = validated.customerEmail || (user?.tgId ? `tg${user.tgId}@astro-orb.app` : undefined);
      console.log('[YooKassa] Customer email for receipt:', customerEmail);

      // Determine if we should save payment method for auto-renewal (subscriptions only)
      const shouldSavePaymentMethod = validated.kind === 'subscription' && validated.autoRenew === true;
      
      const ykPayment = await createYooKassaPayment({
        amount: amountRUB,
        description,
        returnUrl,
        customerEmail,
        idempotencyKey: validated.idempotencyKey, // Use client's idempotency key for YooKassa
        savePaymentMethod: shouldSavePaymentMethod,
        metadata: {
          internalPaymentId: yookassaPayment.id,
          userId,
          kind: validated.kind,
          tier,
          energyAmount,
          periodMonths: validated.periodMonths || 1,
          autoRenew: validated.autoRenew || false,
          scheduleAfterCurrent: scheduleAfterCurrent ? 'true' : 'false',
        },
      });

      console.log('[YooKassa] YooKassa payment created:', ykPayment.id);

      // PROACTIVE CHECK: Check if this yookassaPaymentId already exists in database
      // This handles case where YooKassa idempotency returned existing payment
      let actualPaymentId = yookassaPayment.id;
      const existingPaymentWithSameYkId = await storage.getYookassaPaymentById(ykPayment.id);
      
      if (existingPaymentWithSameYkId && existingPaymentWithSameYkId.id !== yookassaPayment.id) {
        console.warn('[YooKassa] ⚠️  YooKassa returned existing payment ID (idempotency worked):', ykPayment.id);
        console.log('[YooKassa] Existing payment record:', existingPaymentWithSameYkId.id);
        console.log('[YooKassa] New payment record (will clean up):', yookassaPayment.id);
        
        // YooKassa idempotency worked - it returned an existing payment
        // Simply reuse the existing payment record and clean up the duplicate
        try {
          // Delete the new payment record we just created (it's a duplicate)
          await storage.deleteYookassaPaymentByInternalId(yookassaPayment.id);
          console.log('[YooKassa] ✅ Cleaned up duplicate payment record:', yookassaPayment.id);
          
          // Use the existing payment record AS IS (don't modify its metadata)
          actualPaymentId = existingPaymentWithSameYkId.id;
          console.log('[YooKassa] ✅ Using existing payment record:', actualPaymentId);
        } catch (deleteError) {
          console.error('[YooKassa] Failed to delete duplicate payment record:', deleteError);
          throw deleteError;
        }
      } else {
        // No existing payment with this yookassaPaymentId - safe to update
        try {
          await storage.updateYookassaPayment(yookassaPayment.id, {
            yookassaPaymentId: ykPayment.id,
          });
          console.log('[YooKassa] ✅ Updated payment record with YooKassa ID');
        } catch (updateError: any) {
        // If duplicate key error, this yookassaPaymentId already exists in the database
        // Check by error code and full error string (most robust approach)
        const errorString = JSON.stringify(updateError).toLowerCase();
        console.log('[YooKassa] ============ UPDATE ERROR DETAILS ============');
        console.log('[YooKassa] Error code:', updateError.code);
        console.log('[YooKassa] Error constraint:', updateError.constraint);
        console.log('[YooKassa] Error message:', updateError.message);
        console.log('[YooKassa] Error detail:', updateError.detail);
        console.log('[YooKassa] Full error string:', errorString);
        console.log('[YooKassa] ================================================');
        
        // Check if this is a duplicate yookassa_payment_id error by searching the full error
        // This works even if constraint name is truncated by Postgres
        const isDuplicateYookassaId = 
          updateError.code === '23505' && 
          errorString.includes('yookassa_payment_id');
        
        if (isDuplicateYookassaId) {
          console.warn('[YooKassa] ✅ Duplicate yookassaPaymentId detected - handling gracefully:', ykPayment.id);
          console.log('[YooKassa] This likely means idempotency worked - YooKassa returned an existing payment');
          
          // Find the original payment record with this yookassaPaymentId
          const originalPayment = await storage.getYookassaPaymentById(ykPayment.id);
          if (originalPayment) {
            actualPaymentId = originalPayment.id;
            console.log('[YooKassa] Found original payment record:', actualPaymentId);
          }
          
          // Delete the current payment record we just created (it's a duplicate)
          try {
            await storage.deleteYookassaPaymentByInternalId(yookassaPayment.id);
            console.log('[YooKassa] Cleaned up duplicate payment record:', yookassaPayment.id);
          } catch (deleteError) {
            console.error('[YooKassa] Failed to delete duplicate payment record:', deleteError);
          }
          
          // Continue with the existing payment - the confirmation URL is still valid
        } else {
          throw updateError; // Re-throw if it's a different error
        }
        }
      }

      // Return confirmation URL for redirect
      const confirmationUrl = ykPayment.confirmation?.confirmation_url;
      if (!confirmationUrl) {
        console.error('[YooKassa] No confirmation URL in response');
        return res.status(500).json({ ok: false, error: "Failed to get payment URL" });
      }

      console.log('[YooKassa] Payment created successfully, confirmation URL:', confirmationUrl);
      res.json({
        ok: true,
        data: {
          confirmationUrl,
          paymentId: actualPaymentId,
          yookassaPaymentId: ykPayment.id,
        },
      });
    } catch (error: any) {
      // DO NOT delete the payment record on error!
      // Keep it in pending state so client can retry with same idempotency key
      // The next request will find this record and return 202 (retry)
      console.log('[YooKassa] Payment creation failed but keeping record for retry:', yookassaPayment?.id);
      
      if (error instanceof z.ZodError) {
        console.error('[YooKassa] Validation error:', error.errors);
        return res.status(400).json({ ok: false, error: error.errors[0].message });
      }
      console.error('[YooKassa] Create payment error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // YooKassa check payment status endpoint
  const checkStatusSchema = z.object({
    paymentId: z.string(),
  });

  app.post("/api/payments/yookassa/check-status", async (req, res) => {
    try {
      const validated = checkStatusSchema.parse(req.body);
      console.log('[YooKassa Check] Checking payment status:', validated.paymentId);

      // Get internal payment record
      const dbPayment = await storage.getYookassaPaymentByInternalId(validated.paymentId);
      if (!dbPayment) {
        console.error('[YooKassa Check] Payment not found:', validated.paymentId);
        return res.status(404).json({ ok: false, error: "Payment not found" });
      }

      console.log('[YooKassa Check] Payment found:', {
        id: dbPayment.id,
        status: dbPayment.status,
        yookassaId: dbPayment.yookassaPaymentId,
      });

      // If payment already completed, return success
      if (dbPayment.status === 'completed') {
        return res.json({
          ok: true,
          data: {
            status: 'succeeded',
            energyAmount: dbPayment.energyAmount,
            tier: dbPayment.tier,
            kind: dbPayment.kind,
          },
        });
      }

      // If payment has yookassaPaymentId, check status with YooKassa API
      if (dbPayment.yookassaPaymentId) {
        try {
          const ykPayment = await getYooKassaPayment(dbPayment.yookassaPaymentId);
          console.log('[YooKassa Check] YooKassa payment status:', ykPayment.status);

          // If succeeded on YooKassa side, activate via shared function
          if (ykPayment.status === 'succeeded' && ykPayment.paid) {
            console.log('[YooKassa Check] Payment succeeded, activating...');
            await activateSucceededYookassaPayment(dbPayment, ykPayment, storage);

            return res.json({
              ok: true,
              data: {
                status: 'succeeded',
                energyAmount: dbPayment.energyAmount,
                tier: dbPayment.tier,
                kind: dbPayment.kind,
              },
            });
          } else if (ykPayment.status === 'waiting_for_capture') {
            // Payment is being processed by bank
            return res.json({
              ok: true,
              data: {
                status: 'processing',
                kind: dbPayment.kind,
                message: 'Payment is being processed by bank',
              },
            });
          } else if (ykPayment.status === 'pending') {
            // Payment created but not completed (user exited without paying)
            return res.json({
              ok: true,
              data: {
                status: 'abandoned',
                kind: dbPayment.kind,
                message: 'Payment was not completed',
              },
            });
          } else {
            // canceled, failed, etc
            await storage.updateYookassaPayment(dbPayment.id, {
              status: ykPayment.status === 'canceled' ? 'canceled' : 'failed',
            });
            return res.json({
              ok: true,
              data: {
                status: 'failed',
                kind: dbPayment.kind,
                message: 'Payment was not completed',
              },
            });
          }
        } catch (error: any) {
          console.error('[YooKassa Check] Error fetching YooKassa payment:', error);
          return res.status(500).json({ ok: false, error: "Failed to check payment status" });
        }
      } else {
        // Payment doesn't have yookassaPaymentId yet (still being created)
        return res.json({
          ok: true,
          data: {
            status: 'pending',
            kind: dbPayment.kind,
            message: 'Payment is being created',
          },
        });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ ok: false, error: error.errors[0].message });
      }
      console.error('[YooKassa Check] Error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // ===== Telegram Stars (XTR) =====
  app.post("/api/payments/stars/create-invoice", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const { packId } = req.body || {};
      const { createStarsInvoiceLink } = await import("./lib/telegramStars");
      const pack = getOrbPack(packId);
      if (!pack) return res.status(400).json({ ok: false, error: "unknown_pack" });
      const payload = JSON.stringify({ t: "orbs", u: userId, o: pack.orbs, p: packId });
      const link = await createStarsInvoiceLink({
        title: `${pack.orbs} звёзд Astro Orb`,
        description: `Пакет из ${pack.orbs} звёзд для функций приложения`,
        payload,
        stars: pack.stars,
      });
      return res.json({ ok: true, link });
    } catch (e: any) {
      console.error("[STARS] create-invoice error:", e);
      return res.status(500).json({ ok: false, error: "stars_invoice_failed" });
    }
  });

  // Star-подписка (30 дней, автопродление на стороне Telegram)
  // Подписка за Stars. mode=new (1 мес → recurring 30 дней; 6/12 → разовый инвойс),
  // mode=renew (продление на N мес), mode=upgrade (Standard→Premium: доплата + N мес). Цена = ceil(₽).
  app.post("/api/payments/stars/create-subscription", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const tier = String(req.body?.tier || '');
      const periodMonths = Number(req.body?.periodMonths) || 1;
      const mode = String(req.body?.mode || 'new');
      if (tier !== 'standard' && tier !== 'premium') return res.status(400).json({ ok: false, error: "invalid_tier" });
      if (![1, 6, 12].includes(periodMonths)) return res.status(400).json({ ok: false, error: "invalid_period" });
      if (!['new', 'renew', 'upgrade'].includes(mode)) return res.status(400).json({ ok: false, error: "invalid_mode" });
      const months = periodMonths as PeriodMonths;

      const { createStarsSubscriptionLink, createStarsInvoiceLink } = await import("./lib/telegramStars");
      const sub = await storage.getSubscription(userId);
      const subActive = !!sub && sub.status === 'active' && new Date(sub.currentPeriodEnd) > new Date();
      const rank = (t: string) => (t === 'pro' || t === 'premium' ? 2 : t === 'standard' ? 1 : 0);

      // Новая месячная — recurring (Telegram продлевает сам)
      if (mode === 'new' && months === 1) {
        if (subActive && sub!.paymentProvider === 'stars' && rank(sub!.tier) >= rank(tier)) {
          return res.status(409).json({ ok: false, error: "stars_subscription_active" });
        }
        const link = await createStarsSubscriptionLink({ tier, userId });
        return res.json({ ok: true, link, stars: STARS_SUB_PRICES[tier], recurring: true });
      }

      let rub = 0;
      let title = '';
      let description = '';
      let ext: PeriodMonths | 0 = months;
      if (mode === 'new') {
        rub = subscriptionRub(tier, months);
        title = `Astro Orb ${tier === 'premium' ? 'Premium' : 'Standard'} — ${PERIOD_LABEL_RU[months]}`;
        description = subActive && rank(sub!.tier) > rank(tier)
          ? `Подписка ${tier === 'premium' ? 'Premium' : 'Standard'} на ${PERIOD_LABEL_RU[months]}, стартует после окончания текущей`
          : `Подписка ${tier === 'premium' ? 'Premium' : 'Standard'} на ${PERIOD_LABEL_RU[months]}`;
      } else if (mode === 'renew') {
        if (!subActive) return res.status(400).json({ ok: false, error: "no_active_subscription" });
        const curTier = normalizePaidTier(sub!.tier);
        rub = subscriptionRub(curTier, months);
        title = `Продление ${curTier === 'premium' ? 'Premium' : 'Standard'} — ${PERIOD_LABEL_RU[months]}`;
        description = `Подписка продлится на ${PERIOD_LABEL_RU[months]} от текущей даты окончания`;
      } else {
        if (!subActive || sub!.tier !== 'standard') return res.status(400).json({ ok: false, error: "no_standard_to_upgrade" });
        const remainingDays = Math.ceil(Math.max(0, new Date(sub!.currentPeriodEnd).getTime() - Date.now()) / 86400000);
        rub = upgradeRub(remainingDays) + (months > 1 ? subscriptionRub('premium', months) : 0);
        ext = months > 1 ? months : 0;
        title = months > 1 ? `Premium: апгрейд + ${PERIOD_LABEL_RU[months]}` : 'Апгрейд до Premium';
        description = months > 1
          ? `Доплата за ${remainingDays} дн. текущего периода + Premium на ${PERIOD_LABEL_RU[months]}`
          : `Доплата за ${remainingDays} оставшихся дней, дата окончания не меняется`;
      }
      const stars = starsForRub(rub);
      const payload = JSON.stringify({ t: 'subonce', u: userId, tier, m: months, mode, ext, rub });
      const link = await createStarsInvoiceLink({ title, description, payload, stars });
      return res.json({ ok: true, link, stars, recurring: false });
    } catch (e: any) {
      console.error("[STARS] create-subscription error:", e);
      return res.status(500).json({ ok: false, error: "stars_subscription_failed" });
    }
  });

  // Вебхук бота: pre_checkout + successful_payment (Stars)
  app.post("/webhooks/telegram", async (req, res) => {
    try {
      const secret = req.headers["x-telegram-bot-api-secret-token"];
      if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
        return res.status(401).json({ ok: false });
      }
      const update = req.body || {};

      if (update.pre_checkout_query) {
        const { answerPreCheckout } = await import("./lib/telegramStars");
        await answerPreCheckout(update.pre_checkout_query.id, true);
        return res.json({ ok: true });
      }

      const sp = update.message?.successful_payment;
      if (sp) {
        const chargeId = sp.telegram_payment_charge_id;
        // exactly-once: дедуп по журналу
        try {
          const { paymentEventLog } = await import("../shared/schema");
          await db.insert(paymentEventLog).values({ provider: "stars", eventId: chargeId, eventType: "successful_payment", payload: update });
        } catch (dupErr: any) {
          if (dupErr?.code === "23505" || String(dupErr?.message || "").includes("duplicate")) {
            return res.json({ ok: true, duplicate: true });
          }
          console.error("[STARS] event log error (non-blocking):", dupErr);
        }
        let payload: any = {};
        try { payload = JSON.parse(sp.invoice_payload || "{}"); } catch { /* noop */ }
        if (payload.t === "orbs" && payload.u && payload.o) {
          try {
            await creditPurchasedOrbs(storage, payload.u, Number(payload.o), 'stars');
          } catch (creditErr) {
            console.error("[STARS] credit failed", payload, creditErr);
          }
        } else if (payload.t === "subonce" && payload.u && (payload.tier === 'standard' || payload.tier === 'premium')) {
          // Разовая оплата подписки звёздами: новая на 6/12 мес, продление, апгрейд
          try {
            const { applySubscriptionUpgrade, applySubscriptionRenewal } = await import("./lib/paymentActivation");
            const months = Number(payload.m) || 1;
            const rubStr = payload.rub ? Number(payload.rub).toFixed(2) : null;
            if (payload.mode === 'upgrade') {
              await applySubscriptionUpgrade(storage, payload.u, months, 'stars', { amountRUB: rubStr, starsChargeId: chargeId });
            } else if (payload.mode === 'renew') {
              await applySubscriptionRenewal(storage, payload.u, months, 'stars', { amountRUB: rubStr, starsChargeId: chargeId });
            } else {
              const cur = await storage.getSubscription(payload.u);
              const curActive = !!cur && cur.status === 'active' && new Date(cur.currentPeriodEnd) > new Date();
              const rank = (t: string) => (t === 'pro' || t === 'premium' ? 2 : t === 'standard' ? 1 : 0);
              if (curActive && rank(cur!.tier) > rank(payload.tier)) {
                // Оплаченный даунгрейд — после текущей
                await storage.updateSubscription(cur!.id, {
                  scheduledTier: payload.tier === 'premium' ? 'pro' : 'standard',
                  scheduledPeriodMonths: months, scheduledAmountRUB: rubStr, autoRenew: false,
                });
                console.log(`[STARS] Scheduled ${payload.tier} x${months}mo after ${cur!.currentPeriodEnd} (user ${payload.u})`);
              } else {
                await activateSubscriptionForUser(storage, {
                  userId: payload.u, tier: payload.tier, periodMonths: months, source: 'stars',
                  meta: { starsChargeId: chargeId, amountRUB: rubStr, autoRenew: false, extend: true },
                });
              }
            }
          } catch (subErr) {
            console.error("[STARS] subonce activation failed", payload, subErr);
            try {
              const { sendSupportAlert } = await import("./lib/support");
              await sendSupportAlert("Stars: разовая подписка оплачена, активация упала", `user ${payload.u}, ${JSON.stringify(payload)}, charge ${chargeId}: ${String(subErr)}`);
            } catch { /* noop */ }
          }
        } else if (payload.t === "sub" && payload.u && (payload.tier === 'standard' || payload.tier === 'premium')) {
          // Первая оплата и каждое автопродление приходят одинаково (is_recurring / is_first_recurring).
          // Дедуп по charge_id уже прошёл выше → активируем/продлеваем через единую точку.
          try {
            const expiresAt = sp.subscription_expiration_date
              ? new Date(Number(sp.subscription_expiration_date) * 1000)
              : null;
            const result = await activateSubscriptionForUser(storage, {
              userId: payload.u,
              tier: payload.tier,
              periodDays: 30,
              source: 'stars',
              meta: { starsChargeId: chargeId, starsExpiresAt: expiresAt, autoRenew: true, extend: true },
            });
            console.log(`[STARS] subscription ${payload.tier} for ${payload.u}: recurring=${!!sp.is_recurring} first=${!!sp.is_first_recurring} renewed=${result.renewed}`);
          } catch (subErr) {
            console.error("[STARS] subscription activation failed", payload, subErr);
            try {
              const { sendSupportAlert } = await import("./lib/support");
              await sendSupportAlert("Stars: подписка оплачена, активация упала", `user ${payload.u}, tier ${payload.tier}, charge ${chargeId}: ${String(subErr)}`);
            } catch { /* noop */ }
          }
        }
        return res.json({ ok: true });
      }

      // /paysupport и прочие сообщения — вежливый ответ
      const text = update.message?.text;
      if (text && text.startsWith("/paysupport")) {
        const chatId = update.message.chat?.id;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (chatId && botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: "Поддержка по оплатам Astro Orb: опишите проблему, приложите дату и сумму — ответим и при необходимости вернём звёзды. Контакт: @AstroOrbSupport" }),
          });
        }
      }
      return res.json({ ok: true });
    } catch (e) {
      console.error("[TG WEBHOOK] error:", e);
      return res.status(200).json({ ok: true }); // не заставляем Telegram ретраить бесконечно
    }
  });

  // YooKassa webhook endpoint
  app.post("/webhooks/yookassa", async (req, res) => {
    try {
      // Verify webhook IP (optional in test mode)
      const clientIP = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() 
        || req.socket.remoteAddress 
        || '';

      console.log('[YooKassa Webhook] Request received from IP:', clientIP);

      if (!verifyWebhookIP(clientIP)) {
        console.warn('[YooKassa Webhook] SECURITY: Request from unauthorized IP:', clientIP);
        return res.status(403).json({ ok: false, error: "Unauthorized IP" });
      }

      // Parse webhook payload
      // Exactly-once: журналируем событие, дубликаты (ретраи ЮKassa) отвечаем 200 без повторной обработки
      try {
        const { paymentEventLog } = await import("../shared/schema");
        const evId = `${req.body?.event || 'evt'}:${req.body?.object?.id || JSON.stringify(req.body).slice(0, 64)}`;
        await db.insert(paymentEventLog).values({ provider: 'yookassa', eventId: evId, eventType: req.body?.event, payload: req.body });
      } catch (dupErr: any) {
        if (String(dupErr?.message || dupErr).includes('duplicate') || dupErr?.code === '23505') {
          console.log('[YooKassa Webhook] Duplicate event — acknowledged, skipped');
          return res.status(200).json({ ok: true, duplicate: true });
        }
        console.error('[YooKassa Webhook] event log error (non-blocking):', dupErr);
      }

      const payment = parseWebhookPayload(req.body);
      if (!payment) {
        console.error('[YooKassa Webhook] Invalid webhook payload');
        return res.status(400).json({ ok: false, error: "Invalid payload" });
      }

      console.log('[YooKassa Webhook] Payment succeeded:', payment.id);
      console.log('[YooKassa Webhook] Metadata:', payment.metadata);

      // Get our internal payment record
      const internalPaymentId = payment.metadata?.internalPaymentId;
      if (!internalPaymentId) {
        console.error('[YooKassa Webhook] No internal payment ID in metadata');
        return res.status(400).json({ ok: false, error: "Missing payment ID" });
      }

      const dbPayment = await storage.getYookassaPaymentByInternalId(internalPaymentId);
      if (!dbPayment) {
        console.error('[YooKassa Webhook] Payment not found in database:', internalPaymentId);
        return res.status(404).json({ ok: false, error: "Payment not found" });
      }

      // Check if already processed
      if (dbPayment.status === 'completed') {
        console.log('[YooKassa Webhook] Payment already processed:', dbPayment.id);
        return res.json({ ok: true, message: "Already processed" });
      }

      console.log('[YooKassa Webhook] Processing payment:', dbPayment.id);
      console.log('[YooKassa Webhook] Payment kind:', dbPayment.kind);

      // Activate via shared function (idempotent)
      const activationResult = await activateSucceededYookassaPayment(dbPayment, payment, storage);
      console.log(`[YooKassa Webhook] Activation result: ${JSON.stringify(activationResult)}`);

      res.json({ ok: true });
    } catch (error: any) {
      console.error('[YooKassa Webhook] Error:', error);
      // Log the error to the database for debugging / replay
      try {
        await storage.logWebhookError({
          paymentId: req.body?.object?.id || req.body?.object?.metadata?.internalPaymentId || null,
          provider: 'yookassa',
          errorMessage: error?.message || String(error),
          payload: req.body || null,
        });
      } catch (logErr) {
        console.error('[YooKassa Webhook] Failed to log webhook error:', logErr);
      }
      // Alert support immediately so a human can investigate / manually activate
      await sendSupportAlert(
        'Ошибка обработки вебхука ЮKassa',
        `Вебхук получен, но активация не прошла.\n` +
        `Ошибка: ${error?.message}\n` +
        `paymentId: ${req.body?.object?.id || 'unknown'}\n` +
        `internalId: ${req.body?.object?.metadata?.internalPaymentId || 'unknown'}`
      ).catch(() => {});
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Admin endpoint for YooKassa payments
  app.get("/api/admin/yookassa/payments", requireAdmin, async (req, res) => {
    try {
      const payments = await storage.getYookassaPaymentsByUserId(''); // Get all
      // Note: storage doesn't have getAllYookassaPayments, so we'll need to add it
      // For now, return empty array
      res.json({
        ok: true,
        payments: [],
      });
    } catch (error: any) {
      console.error('[Admin] YooKassa payments error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Admin: list all pending/non-completed YooKassa payments with user info
  // Stars-платежи из журнала (successful_payment + refund), новые сверху
  app.get("/api/admin/stars/payments", requireAdmin, async (req, res) => {
    try {
      const { paymentEventLog } = await import("../shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      const rows = await db.select().from(paymentEventLog)
        .where(eq(paymentEventLog.provider, 'stars'))
        .orderBy(desc(paymentEventLog.createdAt))
        .limit(200);
      const refunded = new Set(
        rows.filter((r: any) => r.eventType === 'refund').map((r: any) => r.payload?.chargeId)
      );
      const payments = rows
        .filter((r: any) => r.eventType === 'successful_payment')
        .map((r: any) => {
          const sp = r.payload?.message?.successful_payment || {};
          let inv: any = {};
          try { inv = JSON.parse(sp.invoice_payload || '{}'); } catch { /* noop */ }
          return {
            chargeId: r.eventId,
            userId: inv.u || null,
            tgUserId: r.payload?.message?.from?.id || null,
            type: (inv.t === 'sub' || inv.t === 'subonce') ? 'subscription' : 'orbs',
            months: inv.t === 'subonce' ? Number(inv.m) || 1 : (inv.t === 'sub' ? 1 : null),
            tier: inv.tier || null,
            orbs: inv.o ? Number(inv.o) : null,
            stars: Number(sp.total_amount) || null,
            recurring: !!sp.is_recurring,
            refunded: refunded.has(r.eventId),
            createdAt: r.createdAt,
          };
        });
      res.json({ ok: true, data: payments });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Рефанд Stars: вернуть звёзды в Telegram и откатить выдачу (орбы пака / 30 дней подписки)
  app.post("/api/admin/stars/refund", requireAdmin, async (req, res) => {
    try {
      const { userId, chargeId } = req.body || {};
      if (!userId || !chargeId) return res.status(400).json({ ok: false, error: "userId and chargeId required" });
      const { paymentEventLog } = await import("../shared/schema");
      const { and, eq } = await import("drizzle-orm");

      const [event] = await db.select().from(paymentEventLog)
        .where(and(eq(paymentEventLog.provider, 'stars'), eq(paymentEventLog.eventId, String(chargeId))));
      if (!event) return res.status(404).json({ ok: false, error: "charge not found in log" });
      const [already] = await db.select().from(paymentEventLog)
        .where(and(eq(paymentEventLog.provider, 'stars'), eq(paymentEventLog.eventId, `refund_${chargeId}`)));
      if (already) return res.status(409).json({ ok: false, error: "already refunded" });

      const sp = (event.payload as any)?.message?.successful_payment || {};
      let inv: any = {};
      try { inv = JSON.parse(sp.invoice_payload || '{}'); } catch { /* noop */ }
      if (inv.u && inv.u !== userId) return res.status(400).json({ ok: false, error: "charge belongs to another user" });

      const user = await storage.getUser(userId);
      if (!user?.tgId) return res.status(404).json({ ok: false, error: "user not found" });

      const { refundStarPayment } = await import("./lib/telegramStars");
      const ok = await refundStarPayment(Number(user.tgId), String(chargeId));
      if (!ok) return res.status(502).json({ ok: false, error: "Telegram refund failed (уже возвращён или charge неверный)" });

      // Откат выдачи
      let rollback = '';
      if (inv.t === 'orbs' && inv.o) {
        const current = parseFloat(user.referralOrbs || '0');
        await storage.updateUser(userId, { referralOrbs: Math.max(0, current - Number(inv.o)).toString() });
        rollback = `-${inv.o} orbs`;
      } else if (inv.t === 'subonce' && inv.mode === 'upgrade') {
        // Откат апгрейда: тир обратно Standard, −300 бонусных орбов, минус продление (если было)
        const sub = await storage.getSubscription(userId);
        if (sub) {
          const upd: any = { tier: 'standard', autoRenew: false };
          if (inv.ext) upd.currentPeriodEnd = dayjs(sub.currentPeriodEnd).subtract(Number(inv.ext), 'month').toDate();
          await storage.updateSubscription(sub.id, upd);
          const cur = parseFloat(user.subscriptionOrbs || '0');
          await storage.updateUser(userId, { subscriptionOrbs: Math.max(0, cur - 300).toString() });
          rollback = `tier→standard, -300 orbs${inv.ext ? `, -${inv.ext}mo` : ''}`;
        }
      } else if (inv.t === 'sub' || inv.t === 'subonce') {
        const sub = await storage.getSubscription(userId);
        if (sub) {
          if (sub.scheduledTier && inv.t === 'subonce' && inv.mode === 'new') {
            // Оплаченный, но ещё не стартовавший тариф — просто снимаем план
            await storage.updateSubscription(sub.id, { scheduledTier: null, scheduledPeriodMonths: null, scheduledAmountRUB: null });
            rollback = 'scheduled plan removed';
          } else {
            const newEnd = inv.t === 'sub'
              ? dayjs(sub.currentPeriodEnd).subtract(30, 'day').toDate()
              : dayjs(sub.currentPeriodEnd).subtract(Number(inv.m) || 1, 'month').toDate();
            const stillActive = newEnd > new Date();
            await storage.updateSubscription(sub.id, {
              currentPeriodEnd: newEnd,
              status: stillActive ? 'active' : 'canceled',
              autoRenew: false,
            });
            rollback = `-${inv.t === 'sub' ? '30 days' : (inv.m || 1) + 'mo'} (until ${newEnd.toISOString()}, ${stillActive ? 'active' : 'canceled'})`;
          }
        }
      }

      try {
        await db.insert(paymentEventLog).values({
          provider: 'stars', eventId: `refund_${chargeId}`, eventType: 'refund',
          payload: { chargeId, userId, adminRollback: rollback, original: inv, at: new Date().toISOString() },
        });
      } catch (logErr) {
        console.error('[STARS] refund log failed (non-blocking):', logErr);
      }
      console.log(`[STARS] Refunded ${chargeId} for ${userId}: ${rollback}`);
      res.json({ ok: true, data: { rollback } });
    } catch (error: any) {
      console.error('[STARS] refund error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/admin/payments/pending", requireAdmin, async (req, res) => {
    try {
      const pendingPayments = await storage.getPendingYookassaPayments(0);
      const enriched = await Promise.all(
        pendingPayments.map(async (p) => {
          const user = await storage.getUser(p.userId);
          return { ...p, userName: user?.name || p.userId };
        })
      );
      res.json({ ok: true, payments: enriched });
    } catch (error: any) {
      console.error('[Admin] Pending payments error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Admin: list recent webhook errors
  app.get("/api/admin/payments/webhook-errors", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const errors = await storage.getRecentWebhookErrors(limit);
      res.json({ ok: true, errors });
    } catch (error: any) {
      console.error('[Admin] Webhook errors fetch error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/.well-known/tonconnect-manifest.json", (req, res) => {
    res.json({
      url: process.env.SERVER_URL || "https://astro-orb.replit.app",
      name: "Astro Orb",
      iconUrl: `${process.env.SERVER_URL || "https://astro-orb.replit.app"}/icon.png`,
    });
  });

  // Cron endpoint for subscription auto-renewals and notifications
  // Should be called periodically (e.g., every hour via external cron service)
  app.post("/api/cron/subscription-check", async (req, res) => {
    try {
      // Verify cron secret (optional security measure)
      const cronSecret = req.headers['x-cron-secret'];
      const expectedSecret = process.env.CRON_SECRET;
      
      if (expectedSecret && cronSecret !== expectedSecret) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      console.log('[CRON] Starting subscription check...');

      const results = {
        renewals: { processed: 0, successful: 0, failed: 0 },
        notifications: { checked: 0, sent: 0 },
      };

      // Import subscription renewal functions
      const { 
        getSubscriptionsForRenewal, 
        processAutoRenewal,
        getSubscriptionsForNotification,
        getDaysUntilExpiry,
        getExpiryNotificationMessage,
      } = await import('./lib/subscriptionRenewal');

      // 1. Process auto-renewals
      const renewalSubscriptions = await getSubscriptionsForRenewal(storage);
      console.log('[CRON] Found', renewalSubscriptions.length, 'subscriptions for renewal');

      for (const sub of renewalSubscriptions) {
        results.renewals.processed++;
        const result = await processAutoRenewal(sub, storage);
        if (result.success) {
          results.renewals.successful++;
        } else {
          results.renewals.failed++;
          console.log('[CRON] Renewal failed for', sub.id, ':', result.message);
        }
      }

      // 2. Check for expiration notifications
      const notificationSubscriptions = await getSubscriptionsForNotification(storage);
      console.log('[CRON] Found', notificationSubscriptions.length, 'subscriptions for notification');

      for (const sub of notificationSubscriptions) {
        results.notifications.checked++;
        
        try {
          const daysUntilExpiry = getDaysUntilExpiry(sub.currentPeriodEnd);
          const message = getExpiryNotificationMessage(daysUntilExpiry, sub.tier, sub.autoRenew, 'ru');
          
          // Get user's Telegram ID for notification
          const user = await storage.getUser(sub.userId);
          if (user?.tgId) {
            // Send notification via Telegram bot
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (botToken) {
              const telegramMessage = `${message.title}\n\n${message.message}`;
              
              try {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: user.tgId,
                    text: telegramMessage,
                    parse_mode: 'HTML',
                  }),
                });
                
                results.notifications.sent++;
                
                // Mark notification as sent
                await storage.updateSubscription(sub.id, {
                  lastRenewalNotification: new Date(),
                });
                
                console.log('[CRON] Sent notification to user', sub.userId, '- expires in', daysUntilExpiry, 'days');
              } catch (telegramError) {
                console.error('[CRON] Failed to send Telegram notification:', telegramError);
              }
            }
          }
        } catch (notifError) {
          console.error('[CRON] Notification error for subscription', sub.id, ':', notifError);
        }
      }

      console.log('[CRON] Subscription check completed:', results);
      res.json({ ok: true, results });
    } catch (error: any) {
      console.error('[CRON] Subscription check error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Reconciliation cron: find pending YooKassa payments and activate them if YK says succeeded
  // Call every 2 hours via external cron or internal setInterval. Secured by x-cron-secret.
  app.post("/api/cron/reconcile-payments", async (req, res) => {
    try {
      const cronSecret = req.headers['x-cron-secret'];
      const expectedSecret = process.env.CRON_SECRET;
      if (expectedSecret && cronSecret !== expectedSecret) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      console.log('[RECONCILE] Starting payment reconciliation...');

      // 1. YooKassa: check all non-completed/non-canceled payments older than 10 min
      const pendingYkPayments = await storage.getPendingYookassaPayments(10);
      console.log(`[RECONCILE] Found ${pendingYkPayments.length} pending YooKassa payments`);

      const ykResults = { activated: 0, alreadyDone: 0, notSucceeded: 0, noYkId: 0, errors: 0 };
      for (const payment of pendingYkPayments) {
        const result = await reconcileYookassaPayment(payment as any, storage);
        ykResults[result.action === 'activated' ? 'activated'
          : result.action === 'alreadyDone' ? 'alreadyDone'
          : result.action === 'notSucceeded' ? 'notSucceeded'
          : result.action === 'noYkId' ? 'noYkId'
          : 'errors']++;
        if (result.action === 'activated') {
          console.log(`[RECONCILE] ✓ YK activated ${payment.id}: ${result.message}`);
        }
      }

      // 2. TON / Telegram Stars: alert support for any payment stuck pending >1 hour
      // These cannot be auto-activated (require blockchain lookup), but we alert support.
      const pendingTonPayments = await storage.getPendingTonPayments(60); // older than 60 min
      console.log(`[RECONCILE] Found ${pendingTonPayments.length} pending TON/Stars payments (>1h)`);

      let tonAlertsCount = 0;
      for (const payment of pendingTonPayments) {
        const minutesOld = Math.round((Date.now() - new Date(payment.createdAt).getTime()) / 60000);
        await sendSupportAlert(
          'TON/Stars платёж завис в статусе pending',
          `Платёж не подтверждён более ${minutesOld} минут.\n` +
          `Требуется ручная проверка блокчейн-транзакции.\n` +
          `userId: ${payment.userId}\n` +
          `paymentId: ${payment.id}\n` +
          `kind: ${payment.kind}\n` +
          `amountTON: ${payment.amountTON}\n` +
          `walletAddress: ${payment.userWalletAddress || 'unknown'}\n` +
          `createdAt: ${payment.createdAt.toISOString()}`
        ).catch((e: any) => console.error('[RECONCILE] TON alert failed:', e?.message));
        tonAlertsCount++;
      }

      const results = { yookassa: ykResults, tonStarsAlerts: tonAlertsCount };
      console.log('[RECONCILE] Done:', results);
      res.json({ ok: true, results });
    } catch (error: any) {
      console.error('[RECONCILE] Error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Admin: force-activate a specific YooKassa payment by userId + yookassaPaymentId
  app.post("/api/admin/payments/force-activate", requireAdmin, async (req, res) => {
    try {
      const { userId, yookassaPaymentId } = req.body;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ ok: false, error: "userId is required" });
      }
      if (!yookassaPaymentId || typeof yookassaPaymentId !== 'string') {
        return res.status(400).json({ ok: false, error: "yookassaPaymentId is required" });
      }

      const dbPayment = await storage.getYookassaPaymentById(yookassaPaymentId);
      if (!dbPayment) {
        return res.status(404).json({ ok: false, error: "Payment not found in database" });
      }

      // Verify the payment belongs to the specified user
      if (dbPayment.userId !== userId) {
        return res.status(403).json({
          ok: false,
          error: `Payment ${yookassaPaymentId} belongs to a different user`,
        });
      }

      const ykPayment = await getYooKassaPayment(yookassaPaymentId);
      if (ykPayment.status !== 'succeeded' || !ykPayment.paid) {
        return res.status(400).json({
          ok: false,
          error: `Payment is not succeeded on YooKassa side (status: ${ykPayment.status})`,
        });
      }

      const result = await activateSucceededYookassaPayment(dbPayment as any, ykPayment, storage);
      console.log(`[ADMIN] Force-activated payment ${yookassaPaymentId} for user ${userId}:`, result);

      res.json({ ok: true, result, userId: dbPayment.userId, kind: dbPayment.kind });
    } catch (error: any) {
      console.error('[ADMIN] Force-activate error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Admin endpoint to manually trigger subscription check
  app.post("/api/admin/trigger-subscription-check", requireAdmin, async (req, res) => {
    try {
      // Forward to cron endpoint
      const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/cron/subscription-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET || '',
        },
      });
      
      const result = await response.json();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Get subscription auto-renewal status
  app.get("/api/user/subscription/auto-renew", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const subscription = await storage.getSubscription(userId);
      
      if (!subscription) {
        return res.json({ 
          ok: true, 
          data: { 
            hasSubscription: false,
            autoRenew: false,
          } 
        });
      }

      res.json({
        ok: true,
        data: {
          hasSubscription: true,
          autoRenew: subscription.autoRenew || false,
          paymentProvider: subscription.paymentProvider,
          hasPaymentMethod: !!subscription.paymentMethodId,
          periodMonths: subscription.periodMonths || 1,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Toggle auto-renewal
  app.post("/api/user/subscription/auto-renew", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { autoRenew } = req.body;
      
      const subscription = await storage.getSubscription(userId);
      
      if (!subscription) {
        return res.status(404).json({ ok: false, error: "No subscription found" });
      }

      // If turning off auto-renew, also clear payment method
      const updateData: any = { autoRenew: !!autoRenew };
      if (!autoRenew) {
        updateData.paymentMethodId = null;
      }

      await storage.updateSubscription(subscription.id, updateData);
      
      res.json({ 
        ok: true, 
        data: { 
          autoRenew: !!autoRenew,
          message: autoRenew 
            ? 'Автопродление включено' 
            : 'Автопродление отключено'
        } 
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // ============================================================================
  // EXCHANGE RATES ENDPOINTS
  // ============================================================================

  // Get current exchange rates (public endpoint - used by payment pages)
  // TON/USD is refreshed on each request (cached 5 min), USD/RUB cached daily
  app.get("/api/exchange-rates", async (req, res) => {
    try {
      console.log('[ExchangeRates] Getting exchange rates...');
      const rates = await getAllExchangeRates();
      
      res.json({
        ok: true,
        data: {
          usdRub: {
            rate: rates.usdRub.rate,
            cached: rates.usdRub.cached,
            updatedAt: rates.usdRub.updatedAt,
            source: 'cbr', // Central Bank of Russia
          },
          tonUsd: {
            rate: rates.tonUsd.rate,
            cached: rates.tonUsd.cached,
            updatedAt: rates.tonUsd.updatedAt,
            source: 'coingecko',
          },
          tonRub: rates.tonRub, // Calculated: TON/USD * USD/RUB
        },
      });
    } catch (error: any) {
      console.error('[ExchangeRates] Error getting rates:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Cron endpoint: Force refresh exchange rates (daily for CBR)
  app.post("/api/cron/update-exchange-rates", async (req, res) => {
    try {
      console.log('[CRON] Updating exchange rates...');
      const result = await forceRefreshAllRates();
      
      console.log('[CRON] Exchange rates updated:', result);
      res.json({
        ok: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[CRON] Exchange rates update error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Admin endpoint: Get cache status
  app.get("/api/admin/exchange-rates/status", requireAdmin, async (req, res) => {
    try {
      const status = getCacheStatus();
      res.json({
        ok: true,
        data: status,
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // ==========================================
  // LEAD MAGNET ENDPOINTS (PUBLIC - NO AUTH)
  // ==========================================

  // Public generic daily horoscope per sun sign — consumed by the SEO website (ISR).
  // Cached in-memory per sign per Moscow day => max 12 OpenAI calls/day.
  // ===== МАТРИЦА СУДЬБЫ =====
  // Расчёт бесплатен для всех (включая Free) — это acquisition-крючок из SEO-воронки.
  app.get("/api/matrix/me", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

      const birthISO = new Date(user.birthdayDate).toISOString().slice(0, 10);
      const core = calcMatrixFromISO(birthISO);
      if (!core) return res.status(400).json({ ok: false, error: 'Invalid birth date' });

      const locale = String(req.query.locale || 'ru') === 'en' ? 'en' : 'ru';
      const { MATRIX_KB_VERSION } = await import('./lib/openai.js');
      const cached = await storage.getMatrixReadings(userId, locale, birthISO, MATRIX_KB_VERSION);
      const sections = MATRIX_SECTIONS.map((id: string) => ({
        id,
        free: (FREE_MATRIX_SECTIONS as string[]).includes(id),
        content: cached.find((r: any) => r.sectionId === id)?.content ?? null,
      }));

      res.json({ ok: true, core, sections });
    } catch (error: any) {
      console.error('[MATRIX] /me error:', error);
      res.status(500).json({ ok: false, error: 'Matrix calculation failed' });
    }
  });

  app.post("/api/matrix/section", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

      const sectionId = String(req.body.section || '');
      if (!(MATRIX_SECTIONS as readonly string[]).includes(sectionId)) {
        return res.status(400).json({ ok: false, error: 'Unknown section' });
      }
      const locale = String(req.body.locale || 'ru') === 'en' ? 'en' : 'ru';
      const isFree = (FREE_MATRIX_SECTIONS as string[]).includes(sectionId);

      const birthISO = new Date(user.birthdayDate).toISOString().slice(0, 10);
      const core = calcMatrixFromISO(birthISO);
      if (!core) return res.status(400).json({ ok: false, error: 'Invalid birth date' });

      const { generateMatrixSection, MATRIX_KB_VERSION } = await import('./lib/openai.js');

      // Кэш: повторное открытие купленной секции бесплатно
      const existing = await storage.getMatrixReading(userId, sectionId, locale, birthISO, MATRIX_KB_VERSION);
      if (existing) return res.json({ ok: true, section: sectionId, content: existing.content, cached: true });

      // Платные секции: доступ и баланс проверяем ДО генерации, списываем ПОСЛЕ успеха
      if (!isFree) {
        const access = await canAccessFeature(storage, userId, 'matrix_section');
        if (!access.allowed) {
          return res.status(402).json({
            ok: false,
            error: access.requiresPremium ? 'premium_required' : access.requiresSubscription ? 'subscription_required' : 'insufficient_orbs',
            cost: access.cost,
          });
        }
      }

      const content = await generateMatrixSection({
        section: sectionId as any,
        arcana: sectionArcana(core, sectionId as any),
        name: user.name || 'друг',
        gender: (user as any).gender || 'other',
        birthDate: birthISO,
        locale,
      });

      if (!isFree) {
        const deduction = await deductOrbs(storage, userId, 'matrix_section');
        if (!deduction.ok) {
          return res.status(402).json({ ok: false, error: deduction.error || 'insufficient_orbs' });
        }
      }

      await storage.saveMatrixReading({ userId, sectionId, locale, birthDate: birthISO, kbVersion: MATRIX_KB_VERSION, content });
      res.json({ ok: true, section: sectionId, content, cached: false });
    } catch (error: any) {
      console.error('[MATRIX] /section error:', error);
      res.status(500).json({ ok: false, error: 'Matrix section generation failed' });
    }
  });

  app.get("/api/public/sign-horoscope/:sign", async (req, res) => {
    try {
      const SIGN_RU: Record<string, string> = {
        aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы', cancer: 'Рак',
        leo: 'Лев', virgo: 'Дева', libra: 'Весы', scorpio: 'Скорпион',
        sagittarius: 'Стрелец', capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы',
      };
      const slug = String(req.params.sign || '').toLowerCase();
      const signRu = SIGN_RU[slug];
      if (!signRu) {
        return res.status(404).json({ ok: false, error: 'Unknown sign' });
      }

      const locale = String(req.query.locale || 'ru').toLowerCase() === 'en' ? 'en' : 'ru';
      const { generateSignHoroscope } = await import('./lib/openai.js');
      const data = await generateSignHoroscope(slug, signRu, locale);

      // Cacheable by CDN/proxies until next Moscow day (max 24h)
      res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.json({ ok: true, sign: slug, data });
    } catch (error: any) {
      console.error('[PUBLIC_SIGN_HOROSCOPE] Error:', error);
      res.status(503).json({ ok: false, error: 'Horoscope generation temporarily unavailable' });
    }
  });

  // Calculate horoscope for lead magnet (Instagram landing page)
  app.post("/api/lead/calculate", async (req, res) => {
    try {
      console.log('[LEAD] Calculating horoscope for lead magnet...');
      
      const { name, gender, birthDate, birthTime, birthPlace, email } = req.body;

      // Validate required fields
      if (!name || !gender || !birthDate || !birthPlace) {
        return res.status(400).json({ 
          ok: false, 
          error: 'Заполните обязательные поля: имя, пол, дата рождения, место рождения' 
        });
      }

      // Parse birth date
      const birthdayDate = new Date(birthDate);
      if (isNaN(birthdayDate.getTime())) {
        return res.status(400).json({ ok: false, error: 'Неверный формат даты' });
      }

      // Geocode birth place
      console.log('[LEAD] Geocoding birth place:', birthPlace);
      const coords = await geocodeCityWithFallback(birthPlace);
      console.log('[LEAD] Coordinates:', coords);

      // Calculate natal chart using Python Swiss Ephemeris
      // IMPORTANT: Convert local time to UTC for accurate calculations (same as main app)
      const localYear = birthdayDate.getFullYear();
      const localMonth = birthdayDate.getMonth() + 1;
      const localDay = birthdayDate.getDate();
      const localHour = birthTime ? parseInt(birthTime.split(':')[0]) : 12;
      const localMinute = birthTime ? parseInt(birthTime.split(':')[1]) : 0;
      
      // Use timezone based on birth place location (approximate by longitude)
      // Russia spans +2 to +12 UTC; use longitude to estimate timezone offset
      const tzOffsetHours = Math.round(coords.lon / 15); // Approximate timezone from longitude
      const birthTimezone = `Etc/GMT${tzOffsetHours >= 0 ? '-' : '+'}${Math.abs(tzOffsetHours)}`; // Note: Etc/GMT has inverted sign
      
      // Convert local birth time to UTC using dayjs
      const localDateTimeStr = `${localYear}-${String(localMonth).padStart(2, '0')}-${String(localDay).padStart(2, '0')} ${String(localHour).padStart(2, '0')}:${String(localMinute).padStart(2, '0')}:00`;
      const localDateTime = dayjs.tz(localDateTimeStr, birthTimezone);
      const utcDateTime = localDateTime.utc();
      
      console.log('[LEAD] Local birth time:', localDateTimeStr, 'TZ:', birthTimezone);
      console.log('[LEAD] UTC birth time:', utcDateTime.format('YYYY-MM-DD HH:mm'));
      
      const natalInput = {
        year: utcDateTime.year(),
        month: utcDateTime.month() + 1,
        day: utcDateTime.date(),
        hour: utcDateTime.hour(),
        minute: utcDateTime.minute(),
        latitude: coords.lat,
        longitude: coords.lon,
      };

      console.log('[LEAD] Calculating natal chart with Python/SwissEph:', natalInput);
      const natalChart = await calculateNatalChartPython(natalInput);
      console.log('[LEAD] Natal chart result:', JSON.stringify(natalChart, null, 2));
      
      // Validate natal chart result (Python returns planet names with capital letters)
      if (!natalChart || !natalChart.planets || !natalChart.planets.Sun) {
        console.error('[LEAD] Invalid natal chart result:', natalChart);
        return res.status(500).json({ ok: false, error: 'Ошибка расчёта натальной карты. Попробуйте позже.' });
      }
      
      console.log('[LEAD] Natal chart calculated, Sun sign:', natalChart.planets.Sun.sign);

      // Calculate today's transits
      const timezone = 'Europe/Moscow';
      const nowTime = dayjs().tz(timezone);
      const transitData = {
        year: nowTime.year(),
        month: nowTime.month() + 1,
        day: nowTime.date(),
        hour: nowTime.hour(),
        minute: nowTime.minute(),
      };

      console.log('[LEAD] Calculating transits for:', transitData);
      const transits = await calculateTransits(transitData);
      console.log('[LEAD] Transits calculated:', Object.keys(transits.planets).length, 'planets');

      // Map transits to natal houses
      const transitsInNatalHouses = mapTransitsToNatalHouses(transits, natalChart);
      console.log('[LEAD] Transits mapped to natal houses');

      // Generate personalized MONTHLY horoscope using OpenAI for the CURRENT month
      const RU_MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      const currentMonthRu = `${RU_MONTHS[nowTime.month()]} ${nowTime.year()}`;
      const horoscopeResult = await interpretHoroscope({
        profile: {
          name,
          gender,
          timezone,
        },
        natal: natalChart,
        transits: transitsInNatalHouses,
      }, 'ru', 'monthly', currentMonthRu);

      console.log('[LEAD] Monthly horoscope generated successfully');

      // Traffic source: 'instagram' by default, website sends its own (e.g. 'website_natal-chart')
      const leadSource = (typeof req.body.source === 'string' && /^[a-z0-9_-]{1,50}$/i.test(req.body.source))
        ? req.body.source
        : 'instagram';

      // Create lead in database
      const lead = await storage.createLead({
        name,
        gender,
        birthdayDate,
        birthTime: birthTime || null,
        birthPlace,
        timezone,
        email: email || null,
        source: leadSource,
      });

      // Update lead with calculated data
      await storage.updateLead(lead.id, {
        natalChart: natalChart,
        horoscope: horoscopeResult,
      });

      console.log('[LEAD] Lead created with ID:', lead.id);

      // Get sun sign and ascendant from natal chart (Python returns with capital letters)
      const sunSign = natalChart.planets.Sun.sign;
      // Ascendant sign comes from angles
      const ascendantSign = natalChart.angles?.Ascendant?.sign || null;

      // Format monthly horoscope for lead magnet display
      // interpretHoroscope for monthly returns: { overview, money, work, love, health, advice }
      
      // Format response for frontend with actual horoscope content
      res.json({
        ok: true,
        data: {
          leadId: lead.id,
          sunSign: getZodiacSignRu(sunSign),
          ascendant: ascendantSign ? getZodiacSignRu(ascendantSign) : null,
          monthName: currentMonthRu,
          horoscope: {
            overview: horoscopeResult.overview || 'Этот месяц принесёт интересные возможности',
            money: horoscopeResult.money || 'Благоприятный период для финансовых дел',
            work: horoscopeResult.work || 'Хорошие карьерные перспективы',
            love: horoscopeResult.love || 'Гармоничные отношения с близкими',
            health: horoscopeResult.health || 'Уделите внимание отдыху',
            advice: horoscopeResult.advice || 'Доверяйте своей интуиции',
          },
        },
      });

    } catch (error: any) {
      console.error('[LEAD] Error calculating horoscope:', error);
      res.status(500).json({ 
        ok: false, 
        error: 'Ошибка расчёта гороскопа. Попробуйте снова.' 
      });
    }
  });

  // Get lead by ID (for registration form to retrieve lead data)
  // Returns only minimal data needed for form pre-fill (no full PII exposure)
  app.get("/api/lead/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate lead ID format (nanoid format: 21 chars alphanumeric)
      if (!id || id.length !== 21 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        return res.status(404).json({ ok: false, error: 'Not found' });
      }
      
      const lead = await storage.getLead(id);
      
      if (!lead) {
        return res.status(404).json({ ok: false, error: 'Not found' });
      }

      // Don't return already converted leads
      if (lead.convertedToUserId) {
        return res.status(410).json({ ok: false, error: 'Already used' });
      }

      // Return only minimal data needed for form pre-fill
      // Don't expose natal chart or full interpretation data
      res.json({ 
        ok: true, 
        data: {
          id: lead.id,
          name: lead.name,
          gender: lead.gender,
          birthDate: lead.birthdayDate,
          birthTime: lead.birthTime,
          birthPlace: lead.birthPlace,
          timezone: lead.timezone,
        }
      });
    } catch (error: any) {
      console.error('[LEAD] Error getting lead:', error);
      res.status(500).json({ ok: false, error: 'Server error' });
    }
  });

  // Mark lead as converted after user registration
  // Note: Lead ID comes from Telegram start_param which is tied to specific user session
  app.post("/api/lead/:id/convert", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;
      
      // Validate lead ID format
      if (!id || id.length !== 21 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        return res.status(404).json({ ok: false, error: 'Not found' });
      }
      
      const lead = await storage.getLead(id);
      if (!lead) {
        return res.status(404).json({ ok: false, error: 'Not found' });
      }

      // Already converted - idempotent success if same user
      if (lead.convertedToUserId) {
        if (lead.convertedToUserId === userId) {
          return res.json({ ok: true, data: { alreadyConverted: true } });
        }
        return res.status(410).json({ ok: false, error: 'Already used' });
      }

      const updatedLead = await storage.markLeadConverted(id, userId);
      console.log('[LEAD] Lead converted:', id, '-> User:', userId);
      
      res.json({ ok: true, data: { converted: true } });
    } catch (error: any) {
      console.error('[LEAD] Error converting lead:', error);
      res.status(500).json({ ok: false, error: 'Server error' });
    }
  });

  // Helper function for Russian zodiac sign names
  function getZodiacSignRu(sign: string): string {
    const signs: Record<string, string> = {
      'Aries': 'Овен',
      'Taurus': 'Телец',
      'Gemini': 'Близнецы',
      'Cancer': 'Рак',
      'Leo': 'Лев',
      'Virgo': 'Дева',
      'Libra': 'Весы',
      'Scorpio': 'Скорпион',
      'Sagittarius': 'Стрелец',
      'Capricorn': 'Козерог',
      'Aquarius': 'Водолей',
      'Pisces': 'Рыбы',
    };
    return signs[sign] || sign;
  }

  const httpServer = createServer(app);
  return httpServer;
}
