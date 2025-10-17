import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage";
import { requireAuth, requireAdmin } from "./middleware/auth";
import { validateTelegramInitData, parseTelegramInitData } from "./lib/telegram";
import { generateToken } from "./lib/jwt";
import { generateReferralCode, applyReferralBonus, handleSubscriptionReferralBonus } from "./lib/referral";
import { checkAndResetEnergy, checkSubscriptionExpiry, deductEnergy, getNextResetTime, ENERGY_COSTS } from "./lib/energy";
import { getTonPrice, convertUSDToTON, verifyTonTransaction, findRecentTransaction, findUserTransaction, normalizeTonAddress } from "./lib/ton";
import { calculateNatalChart, calculateSolarReturn, calculateBaZi } from "./lib/astrology";
import { getAstrologyInterpretation, getPlanetInterpretation, interpretImportantDate, interpretHoroscope, generateWeeklyPlan, generateMonthlyPlan, type PlanetInterpretationData, type ImportantDateInterpretationInput } from "./lib/openai";
import { calculateNatalChartPython, type NatalChartResult } from "./lib/pythonNatal";
import { ensureUserNatalChart, computeNatalFromUser, recomputeIfProfileChanged } from "./lib/natalService";
import { findImportantEvents, extractNatalPlanets } from "./lib/transits";
import { geocodeCityWithFallback } from "./lib/geocoding";
import { handleTelegramLoginWidget } from "./lib/tgLoginVerify";
import { createInvoiceLink, answerPreCheckoutQuery, refundStarPayment, signPayload, verifyPayload } from "./lib/telegramStars";
import { z } from "zod";
import dayjs from 'dayjs';

interface StoredNatalChart extends NatalChartResult {
  interpretation?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/telegram", async (req, res) => {
    try {
      const { initData, name, gender, age, birthdayDate, birthTime, birthPlace, timezone } = req.body;

      if (!validateTelegramInitData(initData)) {
        return res.status(401).json({ ok: false, error: "Invalid Telegram data" });
      }

      const tgUser = parseTelegramInitData(initData);
      if (!tgUser) {
        return res.status(401).json({ ok: false, error: "Invalid Telegram user" });
      }

      let user = await storage.getUserByTgId(tgUser.id.toString());

      if (!user) {
        const referralCode = generateReferralCode();
        user = await storage.createUser({
          tgId: tgUser.id.toString(),
          username: tgUser.username || null,
          name: name || tgUser.first_name || "User",
          gender: gender || "other",
          age: age || 25,
          birthdayDate: new Date(birthdayDate || new Date()),
          birthTime: birthTime || null,
          birthPlace: birthPlace || null,
          timezone: timezone || "Europe/Moscow",
          referralCode,
        });

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
      }

      const token = generateToken(user.id);

      res.json({ ok: true, data: { user, token } });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Telegram Login Widget (web login)
  app.post("/api/auth/tg-login", handleTelegramLoginWidget);

  app.post("/api/auth/test", async (req, res) => {
    // STRICT: Only allow when explicitly enabled via ALLOW_TEST_AUTH flag
    // This prevents accidental usage in staging/production even if NODE_ENV is misconfigured
    const isTestAuthAllowed = process.env.ALLOW_TEST_AUTH === 'true';
    
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

      const { name, gender, age, birthdayDate, birthTime, birthPlace, timezone, referralCode: inputReferralCode } = req.body;
      const testUsername = `test_user_${Date.now()}`;
      const testTgId = `test_${Date.now()}`;

      let user = await storage.getUserByTgId(testTgId);

      if (!user) {
        const referralCode = generateReferralCode();
        const newUser = {
          tgId: testTgId,
          username: testUsername,
          name: name || "Test User",
          gender: gender || "other",
          age: age || 25,
          birthdayDate: new Date(birthdayDate || new Date()),
          birthTime: birthTime || null,
          birthPlace: birthPlace || null,
          timezone: timezone || "America/New_York",
          referralCode,
          freeEnergy: 10,
          energyResetAt: getNextResetTime(timezone || "America/New_York"),
        };

        user = await storage.createUser(newUser);

        if (inputReferralCode) {
          await applyReferralBonus(storage, user.id, inputReferralCode);
        }
      }

      const token = generateToken(user.id);

      res.json({ ok: true, data: { user, token } });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/user/me", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      await checkAndResetEnergy(storage, userId);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      // IMPORTANT: Check subscription expiry to keep dashboard status accurate
      const subscription = await checkSubscriptionExpiry(storage, userId);
      const natalChart = await storage.getNatalChart(userId);

      res.json({ ok: true, data: { 
        ...user, 
        energy: (user.freeEnergy || 0) + (user.purchasedEnergy || 0),
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
      const { name, gender, age, birthdayDate, birthTime, birthPlace, timezone } = req.body;

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

      const user = await storage.updateUser(userId, {
        name,
        gender,
        age,
        birthdayDate: new Date(birthdayDate),
        birthTime,
        birthPlace,
        timezone,
        lastProfileUpdate: new Date(),
      });

      res.json({ ok: true, data: user });
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
      
      if (!tier || (tier !== 'standard' && tier !== 'pro')) {
        return res.status(400).json({ ok: false, error: "Invalid tier. Use 'standard' or 'pro'" });
      }
      
      const startedAt = new Date();
      const currentPeriodEnd = dayjs(startedAt).add(30, "days").toDate();
      
      const existingSub = await storage.getSubscription(userId);
      
      if (existingSub) {
        await storage.updateSubscription(existingSub.id, {
          tier,
          status: 'active',
          currentPeriodEnd,
        });
      } else {
        await storage.createSubscription({
          userId,
          tier,
          status: 'active',
          startedAt,
          currentPeriodEnd,
        });
      }
      
      // IMPORTANT: Credit subscription energy immediately (add to existing balance)
      const subscriptionEnergy = tier === 'standard' ? 100 : 250;
      const user = await storage.getUser(userId);
      if (user) {
        await storage.updateUser(userId, {
          purchasedEnergy: (user.purchasedEnergy || 0) + subscriptionEnergy,
        });
      }
      
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
      const locale = req.body.locale || 'ru';
      const chart = await ensureUserNatalChart(userId, locale);
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
      
      // Auto-recalculate if profile changed
      await recomputeIfProfileChanged(userId, locale);
      
      const chart = await storage.getNatalChart(userId);
      
      if (!chart) {
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }
      
      res.json({ ok: true, data: chart });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Force recalculate natal chart (FREE for own chart)
  app.post("/api/natal/recalculate", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const locale = req.body.locale || 'ru';
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      
      // Force recalculation with interpretation
      const newData = await computeNatalFromUser(user, locale);
      await storage.updateNatalChart(userId, { data: newData });
      
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
        timezone: z.string().default("Europe/Moscow"),
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
      
      const birthDate = new Date(data.birthdayDate);
      const birthTimeStr = data.birthTime || "12:00";
      const [hours, minutes] = birthTimeStr.split(":").map(Number);
      
      // Geocode birth city to get coordinates
      const coords = await geocodeCityWithFallback(data.birthPlace || null);
      
      const pythonChart = await calculateNatalChartPython({
        year: birthDate.getFullYear(),
        month: birthDate.getMonth() + 1,
        day: birthDate.getDate(),
        hour: hours,
        minute: minutes,
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
        birthdayDate: birthDate,
        birthTime: data.birthTime || null,
        birthPlace: data.birthPlace || null,
        timezone: data.timezone,
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
      await checkAndResetEnergy(storage, userId);
      
      const user = await storage.getUser(userId);

      res.json({
        ok: true,
        data: {
          energy: user ? (user.freeEnergy + user.purchasedEnergy) : 0,
          resetAt: user?.energyResetAt || new Date(),
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
      
      // Generate AI interpretation
      const interpretation = await getAstrologyInterpretation("natal", savedChart, locale, user.gender);
      
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

  // Роут для интерпретации отдельной планеты (БЕЗ списания энергии)
  app.post("/api/astrology/planet-interpretation", requireAuth, async (req, res) => {
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

      // Получаем данные карты в зависимости от типа
      if (chartType === 'guest' && chartId) {
        // Загружаем гостевую карту
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
        // Для гостевой карты создаем минимальный профиль
        chartOwner = {
          ...user,
          name: guestChart.name,
          gender: guestChart.gender,
          birthdayDate: guestChart.birthdayDate
        } as any;
      } else {
        // Получаем сохраненную натальную карту пользователя
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

      // Определяем дом, в котором находится планета
      const findHouse = (longitude: number): number => {
        if (!savedChart.houses || !Array.isArray(savedChart.houses.cusps)) return 1;
        
        const cusps = savedChart.houses.cusps;
        
        // Перебираем дома и находим, в какой попадает планета
        for (let i = 0; i < 12; i++) {
          const houseStart = cusps[i];
          const nextHouseStart = cusps[(i + 1) % 12];
          
          // Учитываем переход через 0 градусов
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
        return 1; // Fallback
      };

      const house = findHouse(planetData.longitude);

      // Получаем аспекты планеты (если они есть)
      const chartAspects = (savedChart as any).aspects || [];
      const planetAspects = chartAspects.filter((aspect: any) => 
        aspect.planet1 === planet || aspect.planet2 === planet
      ).map((aspect: any) => ({
        to: aspect.planet1 === planet ? aspect.planet2 : aspect.planet1,
        type: aspect.type,
        orb_deg: aspect.orb
      }));

      // Формируем данные для интерпретации
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

      // Получаем интерпретацию от AI
      const interpretation = await getPlanetInterpretation(interpretationData, locale);

      res.json({
        ok: true,
        data: interpretation
      });
    } catch (error: any) {
      console.error('Planet interpretation error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/solar", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const locale = req.body.locale || 'en';
      
      // Check energy first (without deducting)
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const cost = ENERGY_COSTS.solar;
      if ((user.freeEnergy + user.purchasedEnergy) < cost) {
        return res.status(400).json({ ok: false, error: "Insufficient energy" });
      }

      // Execute the reading using Swiss Ephemeris (calculate solar return chart for today)
      const today = new Date();
      const solarYear = today.getFullYear();
      const birthDate = new Date(user.birthdayDate);
      const solarDate = new Date(solarYear, birthDate.getMonth(), birthDate.getDate());
      
      const [hours = 12, minutes = 0] = (user.birthTime || '12:00').split(':').map(Number);
      
      // Geocode birth city to get coordinates
      const coords = await geocodeCityWithFallback(user.birthPlace);
      
      const solarChartData = await calculateNatalChartPython({
        year: solarDate.getFullYear(),
        month: solarDate.getMonth() + 1,
        day: solarDate.getDate(),
        hour: hours,
        minute: minutes,
        latitude: coords.lat,
        longitude: coords.lon,
        house_system: 'Placidus',
      });
      
      // Extract Sun position from chart
      const sunData = solarChartData.planets['Sun'];
      const solar = {
        position: sunData.longitude,
        sign: sunData.sign,
        date: solarDate,
      };
      
      const interpretation = await getAstrologyInterpretation("solar", solar, locale, user.gender);

      // Localized insights
      const insights = locale === 'ru' ? [
        'Сегодняшняя космическая энергия поддерживает новые начинания',
        'Сосредоточьтесь на личностном росте и самовыражении',
        'Доверяйте своей интуиции в принятии решений',
      ] : [
        "Today's cosmic energy supports new beginnings",
        'Focus on personal growth and self-expression',
        'Trust your intuition in decision-making',
      ];

      // Only deduct energy after successful execution
      await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
      await storage.createUsageLog({ userId, feature: "solar", cost });

      res.json({
        ok: true,
        data: {
          solar,
          interpretation,
          insights,
        },
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/horoscope", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const locale = req.body.locale || 'ru';

      console.log('[HOROSCOPE] Request started - userId:', userId, 'locale:', locale);

      // Check energy first (without deducting)
      await checkAndResetEnergy(storage, userId);
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

      const cost = ENERGY_COSTS.horoscope;
      if ((user.freeEnergy + user.purchasedEnergy) < cost) {
        return res.status(402).json({ ok: false, error: "Insufficient energy" });
      }

      console.log('[HOROSCOPE] Calling interpretHoroscope...');

      // Generate daily horoscope only
      const result = await interpretHoroscope({
        profile: {
          name: user.name,
          gender: user.gender,
          timezone: user.timezone
        },
        natal: natalChart.data,
        transits: []
      }, locale);

      console.log('[HOROSCOPE] interpretHoroscope returned successfully');

      // Save to database with today's date
      const now = dayjs().tz(user.timezone);
      const today = now.format('YYYY-MM-DD');

      await storage.createHoroscopeReading({
        userId,
        period: 'day',
        startDate: today,
        endDate: today,
        forecast: JSON.stringify(result),
      });

      console.log('[HOROSCOPE] Saved to database');

      // Only deduct energy after successful execution
      await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
      await storage.createUsageLog({ userId, feature: "horoscope", cost });

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
      const { week_start_iso } = req.body;
      const locale = req.body.locale || 'ru';

      console.log('[WEEKLY_PLAN] User ID:', userId);
      console.log('[WEEKLY_PLAN] Request body:', { week_start_iso, locale });

      // Check energy first (without deducting)
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        console.log('[WEEKLY_PLAN] User not found');
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      console.log('[WEEKLY_PLAN] User energy:', (user.freeEnergy + user.purchasedEnergy));

      // Check if natal chart exists in database
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart || !natalChart.data) {
        console.log('[WEEKLY_PLAN] Natal chart not initialized');
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }

      console.log('[WEEKLY_PLAN] Natal chart exists');

      // Check subscription status (CRITICAL: check expiry first!)
      const subscription = await checkSubscriptionExpiry(storage, userId);
      const hasActiveSubscription = subscription?.status === 'active' || subscription?.status === 'canceled';

      console.log('[WEEKLY_PLAN] Has active subscription:', hasActiveSubscription);

      // Subscribers get it free, others pay 1 orb
      if (!hasActiveSubscription) {
        const cost = ENERGY_COSTS.weekly_plan;
        if ((user.freeEnergy + user.purchasedEnergy) < cost) {
          console.log('[WEEKLY_PLAN] Insufficient energy:', (user.freeEnergy + user.purchasedEnergy), '< cost:', cost);
          return res.status(402).json({ ok: false, error: "Insufficient energy" });
        }
      }

      // Calculate week start (always Monday of current week)
      let weekStart = week_start_iso;
      if (!weekStart) {
        const now = dayjs().tz(user.timezone);
        // Get Monday of current week (0=Sunday, 1=Monday, ..., 6=Saturday)
        const dayOfWeek = now.day();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days
        const monday = now.subtract(daysFromMonday, 'day');
        weekStart = monday.format('YYYY-MM-DD');
      }

      // Calculate week end (Sunday)
      const weekEnd = dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD');

      console.log('[WEEKLY_PLAN] Week range:', weekStart, 'to', weekEnd);

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
        transits: []
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

      // Deduct energy only if not subscriber
      if (!hasActiveSubscription) {
        const cost = ENERGY_COSTS.weekly_plan;
        await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
        await storage.createUsageLog({ userId, feature: "weekly_plan", cost });
        console.log('[WEEKLY_PLAN] Energy deducted:', cost);
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

      // Check energy first (without deducting)
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        console.log('[MONTHLY_PLAN] User not found');
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      console.log('[MONTHLY_PLAN] User energy:', (user.freeEnergy + user.purchasedEnergy));

      // Check if natal chart exists in database
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart || !natalChart.data) {
        console.log('[MONTHLY_PLAN] Natal chart not initialized');
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }

      console.log('[MONTHLY_PLAN] Natal chart exists');

      // Check subscription status (CRITICAL: check expiry first!)
      const subscription = await checkSubscriptionExpiry(storage, userId);
      const hasActiveSubscription = subscription?.status === 'active' || subscription?.status === 'canceled';

      console.log('[MONTHLY_PLAN] Has active subscription:', hasActiveSubscription);

      // Subscribers get it free, others pay 1 orb
      if (!hasActiveSubscription) {
        const cost = ENERGY_COSTS.monthly_plan;
        if ((user.freeEnergy + user.purchasedEnergy) < cost) {
          console.log('[MONTHLY_PLAN] Insufficient energy:', (user.freeEnergy + user.purchasedEnergy), '< cost:', cost);
          return res.status(402).json({ ok: false, error: "Insufficient energy" });
        }
      }

      // Calculate month start (always first day of current month)
      let monthStart = month_iso;
      if (!monthStart) {
        const now = dayjs().tz(user.timezone);
        monthStart = now.startOf('month').format('YYYY-MM-DD');
      }

      // Calculate month end (last day of the month)
      const monthEnd = dayjs(monthStart).endOf('month').format('YYYY-MM-DD');

      console.log('[MONTHLY_PLAN] Month range:', monthStart, 'to', monthEnd);

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
        transits: []
      }, locale);

      console.log('[MONTHLY_PLAN] Result received:', JSON.stringify(result).substring(0, 200));

      // Save monthly plan to database with date range
      await storage.createHoroscopeReading({
        userId,
        period: 'month',
        startDate: monthStart,
        endDate: monthEnd,
        forecast: JSON.stringify(result),
        data: result,
      });

      // Deduct energy only if not subscriber
      if (!hasActiveSubscription) {
        const cost = ENERGY_COSTS.monthly_plan;
        await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
        await storage.createUsageLog({ userId, feature: "monthly_plan", cost });
        console.log('[MONTHLY_PLAN] Energy deducted:', cost);
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
      const { partner, professional = false } = req.body;
      const locale = req.body.locale || 'en';

      // Check energy first (without deducting)
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const cost = professional ? ENERGY_COSTS.compatibility_professional : ENERGY_COSTS.compatibility;
      if ((user.freeEnergy + user.purchasedEnergy) < cost) {
        return res.status(400).json({ ok: false, error: "Insufficient energy" });
      }

      // Execute the reading using Swiss Ephemeris for both charts
      // User's chart (use cached if available, or calculate from profile data)
      let person1ChartData: NatalChartResult;
      const natalChart = await storage.getNatalChart(userId);
      if (natalChart && natalChart.data) {
        person1ChartData = natalChart.data as NatalChartResult;
      } else {
        // Parse birth time
        const [hours = 12, minutes = 0] = (user.birthTime || '12:00').split(':').map(Number);
        const birthDate = new Date(user.birthdayDate);
        
        // Geocode birth city to get coordinates
        const coords = await geocodeCityWithFallback(user.birthPlace);
        
        person1ChartData = await calculateNatalChartPython({
          year: birthDate.getFullYear(),
          month: birthDate.getMonth() + 1,
          day: birthDate.getDate(),
          hour: hours,
          minute: minutes,
          latitude: coords.lat,
          longitude: coords.lon,
          house_system: 'Placidus',
        });
      }

      // Partner's chart (always calculate fresh, this is what costs energy)
      const partnerDate = new Date(partner.date);
      const [partnerHours = 12, partnerMinutes = 0] = (partner.time || '12:00').split(':').map(Number);
      
      // Geocode partner's birth city to get coordinates
      const partnerCoords = await geocodeCityWithFallback(partner.place);
      
      const person2ChartData = await calculateNatalChartPython({
        year: partnerDate.getFullYear(),
        month: partnerDate.getMonth() + 1,
        day: partnerDate.getDate(),
        hour: partnerHours,
        minute: partnerMinutes,
        latitude: partnerCoords.lat,
        longitude: partnerCoords.lon,
        house_system: 'Placidus',
      });

      // Transform for AI interpretation (convert to array format expected by AI)
      const person1Chart = {
        planets: Object.entries(person1ChartData.planets).map(([name, data]) => ({
          name,
          sign: data.sign,
          position: data.longitude,
        })),
        aspects: [], // Aspects calculated by Python
      };

      const person2Chart = {
        planets: Object.entries(person2ChartData.planets).map(([name, data]) => ({
          name,
          sign: data.sign,
          position: data.longitude,
        })),
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
          partner_name: partner.name,
          person1: person1Chart,
          person2: person2Chart,
        }, locale, user.gender);
      }

      await storage.createCompatibilityReading({
        userId,
        partnerName: partner.name,
        partnerDate: new Date(partner.date),
        analysis,
        isProfessional: professional,
        professionalInterpretation: professionalInterpretation as any,
        houseOverlays: houseOverlays as any,
      });

      // Only deduct energy after successful execution
      const featureName = professional ? "compatibility_professional" : "compatibility";
      await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
      await storage.createUsageLog({ userId, feature: featureName, cost });

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
          analysis,
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

      // Check energy first (without deducting)
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const cost = ENERGY_COSTS.ask;
      if ((user.freeEnergy + user.purchasedEnergy) < cost) {
        return res.status(400).json({ ok: false, error: "Insufficient energy" });
      }

      // Execute the reading
      const chart = calculateNatalChart(new Date(user.birthdayDate));
      const answer = await getAstrologyInterpretation("ask", { chart, question }, locale, user.gender);

      await storage.createAiQuestion({
        userId,
        question,
        answer,
      });

      // Only deduct energy after successful execution
      await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
      await storage.createUsageLog({ userId, feature: "ask", cost });

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
      
      // Get user's natal chart
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart) {
        return res.status(400).json({ ok: false, error: "Natal chart required. Please create your natal chart first." });
      }
      
      const chartData = natalChart.data as NatalChartResult;
      
      // Extract natal planets for transit calculation
      const natalPlanets = extractNatalPlanets(chartData);
      
      // Find important events (next 90 days)
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + 90);
      
      const events = await findImportantEvents(natalPlanets, {
        from: now,
        to: futureDate,
        limit: 20
      });
      
      // Get user's unlocked events
      const unlocked = await storage.getImportantDateUnlocksByUserId(userId);
      const unlockedKeys = new Set(unlocked.map((u: any) => u.eventKey));
      
      // Mark which events are unlocked
      const eventsWithStatus = events.map(event => ({
        ...event,
        unlocked: unlockedKeys.has(event.key)
      }));
      
      res.json({ ok: true, data: eventsWithStatus });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/important-dates/unlock", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { eventKey } = req.body;
      
      if (!eventKey) {
        return res.status(400).json({ ok: false, error: "Event key is required" });
      }
      
      // Check if already unlocked
      const existing = await storage.getImportantDateUnlockByUserAndKey(userId, eventKey);
      if (existing) {
        return res.json({ ok: true, data: existing });
      }
      
      // Create unlock record (no energy cost for unlock itself)
      const unlock = await storage.createImportantDateUnlock({
        userId,
        eventKey,
      });
      
      res.json({ ok: true, data: unlock });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/important-dates/detail", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { eventKey, locale = 'ru' } = req.body;
      
      if (!eventKey) {
        return res.status(400).json({ ok: false, error: "Event key is required" });
      }
      
      // Check energy first
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      
      const cost = ENERGY_COSTS.important_date_detail;
      if ((user.freeEnergy + user.purchasedEnergy) < cost) {
        return res.status(400).json({ ok: false, error: "Insufficient energy" });
      }
      
      // Get natal chart
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart) {
        return res.status(400).json({ ok: false, error: "Natal chart required" });
      }
      
      const chartData = natalChart.data as NatalChartResult;
      
      // Extract natal planets for transit calculation
      const natalPlanets = extractNatalPlanets(chartData);
      
      // Find all events and locate the requested one
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + 90);
      
      const events = await findImportantEvents(natalPlanets, {
        from: now,
        to: futureDate,
        limit: 20
      });
      
      const event = events.find(e => e.key === eventKey);
      
      if (!event) {
        return res.status(404).json({ ok: false, error: "Event not found" });
      }
      
      // Prepare natal summary for interpretation
      const natalSummary = {
        planets: Object.entries(chartData.planets).map(([name, data]) => ({
          name,
          sign: data.sign,
          house: 1 // Houses not calculated in current version
        })),
        ascendant: chartData.angles?.ascendant
      };
      
      // Build interpretation input
      const interpretationInput: ImportantDateInterpretationInput = {
        profile: {
          name: user.name,
          age: new Date().getFullYear() - new Date(user.birthdayDate).getFullYear(),
          gender: user.gender,
          timezone: user.timezone
        },
        event: {
          kind: event.kind,
          planet: event.planet,
          date: event.date,
          sign: event.sign,
          natalTarget: event.natalTarget,
          brief: event.brief
        },
        natalSummary
      };
      
      // Generate interpretation
      const interpretation = await interpretImportantDate(interpretationInput, locale);
      
      // Deduct energy and log usage
      await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
      await storage.createUsageLog({ userId, feature: "important_date_detail", cost });
      
      // Update unlock record with interpretation
      const unlock = await storage.getImportantDateUnlockByUserAndKey(userId, eventKey);
      if (unlock) {
        await storage.updateImportantDateUnlock(unlock.id, {
          interpretation: interpretation as any
        });
      }
      
      res.json({ ok: true, data: interpretation });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Telegram Stars payment endpoints
  app.post("/api/payments/stars/create-invoice", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { kind, energyAmount, amountStars } = req.body;

      if (!process.env.TELEGRAM_BOT_TOKEN) {
        return res.status(500).json({ ok: false, error: "Telegram bot not configured" });
      }

      // Server-side price validation - CRITICAL SECURITY
      const VALID_PACKS = [
        { amount: 20, stars: 190 },
        { amount: 50, stars: 375 },
        { amount: 120, stars: 750 },
      ];

      if (kind === 'energy_pack') {
        const validPack = VALID_PACKS.find(p => p.amount === energyAmount && p.stars === amountStars);
        if (!validPack) {
          console.error('[STARS] Invalid pack configuration:', { energyAmount, amountStars });
          return res.status(400).json({ ok: false, error: "Invalid pack configuration" });
        }
      }

      // Generate unique invoice payload
      const invoicePayload = `stars_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store payment record
      await storage.createStarPayment({
        userId,
        kind,
        energyAmount,
        amountStars,
        invoicePayload,
      });

      // Create invoice link via Telegram Bot API
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const invoiceData = {
        title: kind === "energy_pack" ? `${energyAmount} Orbs` : "Subscription",
        description: kind === "energy_pack" ? `Buy ${energyAmount} energy orbs` : "Monthly subscription",
        payload: invoicePayload,
        provider_token: "", // Empty for Stars
        currency: "XTR",
        prices: [{
          label: kind === "energy_pack" ? `${energyAmount} Orbs` : "1 Month",
          amount: amountStars
        }]
      };

      const response = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      });

      const data = await response.json();
      
      if (!data.ok) {
        console.error('[STARS] Telegram API error:', data);
        return res.status(500).json({ ok: false, error: data.description || "Failed to create invoice" });
      }

      res.json({ 
        ok: true, 
        data: { 
          invoiceLink: data.result,
          invoicePayload 
        } 
      });
    } catch (error: any) {
      console.error('[STARS] Error creating invoice:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Telegram webhook for Stars payments
  app.post("/api/webhook/telegram", async (req, res) => {
    try {
      // Webhook secret validation (optional but recommended)
      // Telegram webhooks can be set with a secret_token parameter
      const secretToken = req.headers['x-telegram-bot-api-secret-token'];
      if (process.env.TELEGRAM_WEBHOOK_SECRET && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
        console.error('[TELEGRAM_WEBHOOK] Invalid secret token');
        return res.status(403).json({ ok: false, error: "Unauthorized" });
      }

      const update = req.body;
      console.log('[TELEGRAM_WEBHOOK] Received update:', JSON.stringify(update));

      // Handle pre_checkout_query
      if (update.pre_checkout_query) {
        const queryId = update.pre_checkout_query.id;
        const invoicePayload = update.pre_checkout_query.invoice_payload;
        
        console.log('[TELEGRAM_WEBHOOK] Pre-checkout query for:', invoicePayload);

        // Verify payment exists
        const payment = await storage.getStarPaymentByPayload(invoicePayload);
        if (!payment) {
          console.error('[TELEGRAM_WEBHOOK] Payment not found:', invoicePayload);
          // Answer anyway to not block user
          await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pre_checkout_query_id: queryId, ok: false, error_message: "Payment not found" })
          });
          return res.json({ ok: true });
        }

        // Answer pre-checkout query (approve)
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pre_checkout_query_id: queryId, ok: true })
        });

        console.log('[TELEGRAM_WEBHOOK] Pre-checkout approved');
      }

      // Handle successful_payment
      if (update.message?.successful_payment) {
        const payment_info = update.message.successful_payment;
        const invoicePayload = payment_info.invoice_payload;
        const telegramChargeId = payment_info.telegram_payment_charge_id;
        const totalAmount = payment_info.total_amount;

        console.log('[TELEGRAM_WEBHOOK] Successful payment:', { invoicePayload, telegramChargeId, totalAmount });

        // ATOMIC OPERATION: Try to claim this payment for processing
        // This prevents race conditions - only ONE webhook can successfully set status to 'processing'
        const payment = await storage.atomicStartProcessing(invoicePayload, telegramChargeId);
        
        if (!payment) {
          // Payment was already claimed by another webhook, or doesn't exist, or not in pending state
          const existingPayment = await storage.getStarPaymentByPayload(invoicePayload);
          if (!existingPayment) {
            console.error('[TELEGRAM_WEBHOOK] Payment record not found:', invoicePayload);
          } else if (existingPayment.status === 'completed') {
            console.log('[TELEGRAM_WEBHOOK] Payment already completed - idempotency check passed');
          } else if (existingPayment.telegramChargeId && existingPayment.telegramChargeId !== telegramChargeId) {
            console.log('[TELEGRAM_WEBHOOK] Payment already claimed by different charge ID');
          } else {
            console.log('[TELEGRAM_WEBHOOK] Payment already being processed');
          }
          return res.json({ ok: true });
        }

        // We successfully claimed this payment - now verify and process it
        // Verify amount matches (SECURITY: Prevent amount tampering)
        if (payment.amountStars !== totalAmount) {
          console.error('[TELEGRAM_WEBHOOK] Amount mismatch:', { expected: payment.amountStars, received: totalAmount });
          await storage.updateStarPaymentStatus(invoicePayload, {
            status: 'failed'
          });
          return res.json({ ok: true });
        }

        // Process payment
        if (payment.kind === "energy_pack" && payment.energyAmount) {
          const user = await storage.getUser(payment.userId);
          if (user) {
            await storage.updateUser(payment.userId, {
              purchasedEnergy: (user.purchasedEnergy || 0) + payment.energyAmount,
            });
            console.log('[TELEGRAM_WEBHOOK] Energy credited:', payment.energyAmount, 'to user:', payment.userId);
          }
        }

        // Mark payment as completed
        await storage.updateStarPaymentStatus(invoicePayload, {
          status: 'completed',
          telegramChargeId,
          completedAt: new Date()
        });

        console.log('[TELEGRAM_WEBHOOK] Payment processed successfully');
      }

      res.json({ ok: true });
    } catch (error: any) {
      console.error('[TELEGRAM_WEBHOOK] Error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/payments/history", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const payments = await storage.getPaymentsByUserId(userId);
      res.json({ ok: true, data: payments });
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
        return res.json({ ok: true, message: 'No pending payments', found: 0 });
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
          const user = await storage.getUser(userId);
          if (user && payment.energyAmount) {
            await storage.updateUser(userId, {
              purchasedEnergy: (user.purchasedEnergy || 0) + payment.energyAmount,
            });
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
        message: `Checked ${pendingPayments.length} payments, found ${foundCount}`,
        found: foundCount,
        creditedEnergy,
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
            energyAmount: reward.energyAmount,
            createdAt: reward.createdAt,
          };
        })
      );

      res.json({
        ok: true,
        data: {
          referralCode: user.referralCode,
          referrals: referralsWithDetails,
          totalRewards: rewards.reduce((sum, r) => sum + r.energyAmount, 0),
          totalReferrals: rewards.filter(r => r.rewardType === 'signup').length,
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
    tier: z.enum(["standard", "pro"]).optional(),
    energyAmount: z.number().optional(),
    amountUSD: z.number(),
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

      if (!process.env.TON_WALLET_ADDRESS) {
        return res.status(500).json({ 
          ok: false, 
          error: "Payment system not configured. Please contact support." 
        });
      }

      // Get TON price and convert USD to TON
      const tonPrice = await getTonPrice();
      const amountTON = convertUSDToTON(validated.amountUSD, tonPrice);

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
      
      const payment = await storage.createPayment({
        userId,
        kind: validated.kind,
        tier: validated.tier || null,
        energyAmount: validated.energyAmount || null,
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
        return res.json({ ok: true, message: "Already processed" });
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
        console.error('[TON_CONFIRM] No matching unused transaction found on blockchain');
        return res.status(400).json({ 
          ok: false, 
          error: "Transaction not found on blockchain. Please wait a few seconds and try again." 
        });
      }

      // Process payment - credit energy
      if (payment.kind === "energy_pack" && payment.energyAmount) {
        const user = await storage.getUser(userId);
        if (user) {
          await storage.updateUser(userId, {
            purchasedEnergy: (user.purchasedEnergy || 0) + payment.energyAmount,
          });
          console.log('[TON_CONFIRM] Energy credited:', payment.energyAmount, 'to user:', userId);
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
        message: "Payment confirmed",
        txHash: matchedTx.hash 
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
    tier: z.enum(["standard", "pro"]),
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
        const user = await storage.getUser(payment.userId);
        if (user) {
          await storage.updateUser(payment.userId, {
            purchasedEnergy: (user.purchasedEnergy || 0) + payment.energyAmount,
          });
        }
      } else if (payment.kind === "subscription" && payment.tier) {
        // Validate tier is correct type
        if (payment.tier !== "standard" && payment.tier !== "pro") {
          return res.status(400).json({ ok: false, error: "Invalid subscription tier" });
        }
        
        const startedAt = new Date();
        const currentPeriodEnd = dayjs(startedAt).add(30, "days").toDate();

        const existingSub = await storage.getSubscription(payment.userId);
        
        if (existingSub) {
          await storage.updateSubscription(existingSub.id, {
            tier: payment.tier,
            status: "active",
            currentPeriodEnd,
          });
        } else {
          await storage.createSubscription({
            userId: payment.userId,
            tier: payment.tier,
            status: "active",
            startedAt,
            currentPeriodEnd,
          });
        }

        await handleSubscriptionReferralBonus(storage, payment.userId);
        
        // IMPORTANT: Credit subscription energy immediately (add to existing balance)
        const subscriptionEnergy = payment.tier === 'standard' ? 100 : 250;
        const user = await storage.getUser(payment.userId);
        if (user) {
          await storage.updateUser(payment.userId, {
            purchasedEnergy: (user.purchasedEnergy || 0) + subscriptionEnergy,
          });
        }
      }

      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Telegram Stars payment routes
  const createStarsInvoiceSchema = z.object({
    kind: z.enum(["energy_pack", "subscription"]),
    pack: z.object({
      energy: z.number().refine(val => [20, 50, 120].includes(val))
    }).optional(),
    tier: z.enum(["standard", "pro"]).optional(),
  });

  app.post("/api/payments/stars/create", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const validated = createStarsInvoiceSchema.parse(req.body);

      // Determine pricing based on kind and pack/tier
      let title: string;
      let description: string;
      let priceStars: number;
      let energyAmount: number | undefined;
      let tier: string | undefined;

      if (validated.kind === "energy_pack" && validated.pack) {
        const packConfig = {
          20: { stars: 190, label: "20 Orbs Energy Pack" },
          50: { stars: 375, label: "50 Orbs Energy Pack" },
          120: { stars: 750, label: "120 Orbs Energy Pack" },
        }[validated.pack.energy as 20 | 50 | 120];

        if (!packConfig) {
          return res.status(400).json({ ok: false, error: "Invalid energy pack" });
        }

        title = packConfig.label;
        description = `Purchase ${validated.pack.energy} orbs of energy`;
        priceStars = packConfig.stars;
        energyAmount = validated.pack.energy;
      } else if (validated.kind === "subscription" && validated.tier) {
        const tierConfig = {
          standard: { stars: 565, label: "Standard Subscription (1 month)" },
          pro: { stars: 940, label: "Pro Subscription (1 month)" },
        }[validated.tier];

        title = tierConfig.label;
        description = `${validated.tier === 'standard' ? 'Standard (100 daily orbs)' : 'Pro (250 daily orbs)'} for 1 month`;
        priceStars = tierConfig.stars;
        tier = validated.tier;
      } else {
        return res.status(400).json({ ok: false, error: "Invalid request: must specify pack or tier" });
      }

      // Generate short unique payload (well within 128 byte limit)
      const shortPayload = `star_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create payment record with short payload
      const starPayment = await storage.createStarPayment({
        userId,
        kind: validated.kind,
        tier, // For subscriptions
        energyAmount,
        amountStars: priceStars,
        invoicePayload: shortPayload,
      });

      // Create invoice link with short payload
      const invoiceResult = await createInvoiceLink({
        title,
        description,
        payload: shortPayload,
        prices: [{ label: title, amount: priceStars }],
      });

      if (!invoiceResult.ok) {
        return res.status(500).json({ ok: false, error: invoiceResult.error || "Failed to create invoice" });
      }

      res.json({
        ok: true,
        data: {
          invoiceLink: invoiceResult.invoiceLink,
          paymentId: starPayment.id,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ ok: false, error: error.errors[0].message });
      }
      console.error('[Stars] Create invoice error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Telegram webhook endpoint for Stars payments
  app.post("/webhooks/telegram", async (req, res) => {
    try {
      // TODO: Re-enable secret verification for production
      // const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
      // const telegramSecretToken = req.headers['x-telegram-bot-api-secret-token'];
      // if (webhookSecret && telegramSecretToken !== webhookSecret) {
      //   console.warn('[Telegram Webhook] Unauthorized request - invalid or missing secret token');
      //   return res.status(403).json({ ok: false, error: "Unauthorized" });
      // }

      const update = req.body;
      console.log('[Telegram Webhook] Received update:', JSON.stringify(update, null, 2));

      // Handle pre_checkout_query - MUST respond within 10 seconds!
      if (update.pre_checkout_query) {
        const { id: queryId, invoice_payload } = update.pre_checkout_query;
        
        console.log('[Telegram Webhook] Pre-checkout query:', { queryId, invoice_payload });

        // Check if payment exists in database
        const payment = await storage.getStarPaymentByPayload(invoice_payload);
        if (!payment || payment.status !== 'pending') {
          console.error('[Telegram Webhook] Payment not found or already processed');
          await answerPreCheckoutQuery({
            preCheckoutQueryId: queryId,
            ok: false,
            errorMessage: "Order validation failed",
          });
          return res.json({ ok: true });
        }

        // Everything is OK - approve the payment
        await answerPreCheckoutQuery({
          preCheckoutQueryId: queryId,
          ok: true,
        });

        console.log('[Telegram Webhook] Pre-checkout approved');
        return res.json({ ok: true });
      }

      // Handle successful_payment
      if (update.message?.successful_payment) {
        const { telegram_payment_charge_id, invoice_payload } = update.message.successful_payment;
        
        console.log('[Telegram Webhook] Successful payment:', { telegram_payment_charge_id, invoice_payload });

        // Atomic update to prevent race conditions
        const payment = await storage.atomicStartProcessing(invoice_payload, telegram_payment_charge_id);
        
        if (!payment) {
          console.warn('[Telegram Webhook] Payment already processed or not found');
          return res.json({ ok: true });
        }

        // Credit energy or activate subscription
        if (payment.kind === "energy_pack" && payment.energyAmount) {
          const user = await storage.getUser(payment.userId);
          if (user) {
            await storage.updateUser(payment.userId, {
              purchasedEnergy: (user.purchasedEnergy || 0) + payment.energyAmount,
            });
            console.log(`[Telegram Webhook] Credited ${payment.energyAmount} energy to user ${payment.userId}`);
          }
        } else if (payment.kind === "subscription" && payment.tier) {
          const tier = payment.tier as "standard" | "pro";
          
          const startedAt = new Date();
          const currentPeriodEnd = dayjs(startedAt).add(30, "days").toDate();

          const existingSub = await storage.getSubscription(payment.userId);
          
          if (existingSub) {
            await storage.updateSubscription(existingSub.id, {
              tier,
              status: "active",
              currentPeriodEnd,
            });
          } else {
            await storage.createSubscription({
              userId: payment.userId,
              tier,
              status: "active",
              startedAt,
              currentPeriodEnd,
            });
          }

          // Credit subscription energy immediately
          const subscriptionEnergy = tier === 'standard' ? 100 : 250;
          const user = await storage.getUser(payment.userId);
          if (user) {
            await storage.updateUser(payment.userId, {
              purchasedEnergy: (user.purchasedEnergy || 0) + subscriptionEnergy,
            });
          }

          await handleSubscriptionReferralBonus(storage, payment.userId);
          console.log(`[Telegram Webhook] Activated ${tier} subscription for user ${payment.userId}`);
        }

        // Mark payment as completed
        await storage.updateStarPaymentStatus(invoice_payload, {
          status: 'completed',
          completedAt: new Date(),
        });

        console.log('[Telegram Webhook] Payment completed successfully');
        return res.json({ ok: true });
      }

      // Log other update types
      console.log('[Telegram Webhook] Unhandled update type:', Object.keys(update));
      res.json({ ok: true });
    } catch (error: any) {
      console.error('[Telegram Webhook] Error:', error);
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

  const httpServer = createServer(app);
  return httpServer;
}
