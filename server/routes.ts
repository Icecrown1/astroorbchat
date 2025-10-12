import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage";
import { requireAuth, requireAdmin } from "./middleware/auth";
import { validateTelegramInitData, parseTelegramInitData } from "./lib/telegram";
import { generateToken } from "./lib/jwt";
import { generateReferralCode, applyReferralBonus, handleSubscriptionReferralBonus } from "./lib/referral";
import { checkAndResetEnergy, deductEnergy, getNextResetTime, ENERGY_COSTS } from "./lib/energy";
import { getTonPrice, convertUSDToTON, verifyTonTransaction } from "./lib/ton";
import { calculateNatalChart, calculateSolarReturn, calculateBaZi } from "./lib/astrology";
import { getAstrologyInterpretation } from "./lib/openai";
import { calculateNatalChartPython } from "./lib/pythonNatal";
import { z } from "zod";
import dayjs from 'dayjs';

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
          energy: 10,
          energyResetAt: getNextResetTime(timezone || "Europe/Moscow"),
        });

        if (req.body.referralCode) {
          await applyReferralBonus(storage, user.id, req.body.referralCode);
        }
      }

      const token = generateToken(user.id);

      res.json({ ok: true, data: { user, token } });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/auth/test", async (req, res) => {
    console.log('=== /api/auth/test endpoint hit ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    
    try {
      // Allow test endpoint in development or when NODE_ENV is not set (development default)
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        console.log('Blocked: in production mode');
        return res.status(403).json({ ok: false, error: "Test auth only available in development" });
      }

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
          energy: 10,
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
      const subscription = await storage.getSubscription(userId);

      res.json({ ok: true, data: { ...user, subscription } });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/user/update", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { name, gender, age, birthdayDate, birthTime, birthPlace, timezone } = req.body;

      const user = await storage.updateUser(userId, {
        name,
        gender,
        age,
        birthdayDate: new Date(birthdayDate),
        birthTime,
        birthPlace,
        timezone,
      });

      res.json({ ok: true, data: user });
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
          energy: user?.energy || 0,
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

      // Проверяем, есть ли уже сохранённая натальная карта
      if (user.natalChart) {
        // Если карта уже есть - просто генерируем новую интерпретацию
        const interpretation = await getAstrologyInterpretation("natal", user.natalChart, locale);
        
        const savedChart = user.natalChart as any;
        // Преобразуем planets из объекта в массив для фронтенда
        const planetsArray = Object.entries(savedChart.planets).map(([name, data]: [string, any]) => ({
          name,
          sign: data.sign,
          position: data.longitude, // Python возвращает longitude, фронтенд ожидает position
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
            aspects: [], // Python версия пока не рассчитывает аспекты
            interpretation,
          },
        });
        return;
      }

      // Если карты нет - рассчитываем через Python (Swiss Ephemeris)
      if (!user.birthTime) {
        return res.status(400).json({ 
          ok: false, 
          error: "Birth time is required for natal chart calculation" 
        });
      }

      const birthDate = new Date(user.birthdayDate);
      const [hours, minutes] = user.birthTime.split(':').map(Number);
      
      // Парсим координаты из birthPlace (если есть) или используем дефолтные
      // TODO: В будущем нужно сохранять latitude/longitude отдельно
      const latitude = 55.7558; // Москва по умолчанию
      const longitude = 37.6173;

      const pythonChart = await calculateNatalChartPython({
        year: birthDate.getFullYear(),
        month: birthDate.getMonth() + 1,
        day: birthDate.getDate(),
        hour: hours,
        minute: minutes,
        latitude,
        longitude,
        house_system: 'Placidus',
      });

      // Преобразуем planets из объекта в массив для фронтенда
      const planetsArray = Object.entries(pythonChart.planets).map(([name, data]: [string, any]) => ({
        name,
        sign: data.sign,
        position: data.longitude, // Python возвращает longitude, фронтенд ожидает position
        longitude: data.longitude,
        latitude: data.latitude,
        degree_in_sign: data.degree_in_sign,
      }));

      // Генерируем AI интерпретацию
      const interpretation = await getAstrologyInterpretation("natal", pythonChart, locale);

      // Сохраняем натальную карту С ИНТЕРПРЕТАЦИЕЙ в профиле пользователя (бесплатно, навсегда)
      const chartToSave = {
        ...pythonChart,
        interpretation, // Добавляем интерпретацию в сохранённые данные
      };
      
      await storage.updateUser(userId, { 
        natalChart: chartToSave as any 
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
      if (user.energy < cost) {
        return res.status(400).json({ ok: false, error: "Insufficient energy" });
      }

      // Execute the reading
      const solar = calculateSolarReturn(new Date(user.birthdayDate));
      const interpretation = await getAstrologyInterpretation("solar", solar, locale);

      // Only deduct energy after successful execution
      await storage.updateUser(userId, { energy: user.energy - cost });
      await storage.createUsageLog({ userId, feature: "solar", cost });

      res.json({
        ok: true,
        data: {
          solar,
          interpretation,
          insights: [
            "Today's cosmic energy supports new beginnings",
            "Focus on personal growth and self-expression",
            "Trust your intuition in decision-making",
          ],
        },
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/horoscope", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { period } = req.body;
      const locale = req.body.locale || 'en';

      // Check energy first (without deducting)
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const cost = ENERGY_COSTS.horoscope;
      if (user.energy < cost) {
        return res.status(400).json({ ok: false, error: "Insufficient energy" });
      }

      // Execute the reading
      const chart = calculateNatalChart(new Date(user.birthdayDate));
      const forecast = await getAstrologyInterpretation("horoscope", { chart, period }, locale);

      await storage.createHoroscopeReading({
        userId,
        period: period || "daily",
        forecast,
      });

      // Only deduct energy after successful execution
      await storage.updateUser(userId, { energy: user.energy - cost });
      await storage.createUsageLog({ userId, feature: "horoscope", cost });

      res.json({
        ok: true,
        data: {
          period,
          forecast,
          highlights: [
            "Opportunities for growth and expansion",
            "Focus on relationships and communication",
            "Trust your inner wisdom",
          ],
        },
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/astrology/compatibility", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { partner } = req.body;
      const locale = req.body.locale || 'en';

      // Check energy first (without deducting)
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const cost = ENERGY_COSTS.compatibility;
      if (user.energy < cost) {
        return res.status(400).json({ ok: false, error: "Insufficient energy" });
      }

      // Execute the reading
      const person1Chart = calculateNatalChart(new Date(user.birthdayDate));
      const person2Chart = calculateNatalChart(new Date(partner.date));

      console.log('Person 1 chart planets:', person1Chart.planets.length);
      console.log('Person 2 chart planets:', person2Chart.planets.length);

      const analysis = await getAstrologyInterpretation("compatibility", {
        person1: person1Chart,
        person2: person2Chart,
      }, locale);

      await storage.createCompatibilityReading({
        userId,
        partnerName: partner.name,
        partnerDate: new Date(partner.date),
        analysis,
      });

      // Only deduct energy after successful execution
      await storage.updateUser(userId, { energy: user.energy - cost });
      await storage.createUsageLog({ userId, feature: "compatibility", cost });

      res.json({
        ok: true,
        data: {
          partners: `${user.name} & ${partner.name}`,
          analysis,
          strengths: [
            "Strong emotional connection and understanding",
            "Shared values and life goals",
            "Excellent communication and trust",
          ],
          challenges: [
            "Different approaches to conflict resolution",
            "Balance independence with togetherness",
          ],
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
      if (user.energy < cost) {
        return res.status(400).json({ ok: false, error: "Insufficient energy" });
      }

      // Execute the reading
      const chart = calculateNatalChart(new Date(user.birthdayDate));
      const answer = await getAstrologyInterpretation("ask", { chart, question }, locale);

      await storage.createAiQuestion({
        userId,
        question,
        answer,
      });

      // Only deduct energy after successful execution
      await storage.updateUser(userId, { energy: user.energy - cost });
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

  app.get("/api/payments/history", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const payments = await storage.getPaymentsByUserId(userId);
      res.json({ ok: true, data: payments });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/referral/code", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const referrals = [];

      res.json({
        ok: true,
        data: {
          referralCode: user.referralCode,
          referrals,
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
            standard: { usd: 9, ton: (9 / tonRate).toFixed(2) },
            pro: { usd: 15, ton: (15 / tonRate).toFixed(2) },
          },
          energyPacks: {
            small: { amount: 20, usd: 2.99, ton: (2.99 / tonRate).toFixed(2) },
            medium: { amount: 50, usd: 5.99, ton: (5.99 / tonRate).toFixed(2) },
            large: { amount: 120, usd: 11.99, ton: (11.99 / tonRate).toFixed(2) },
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/payments/ton/create", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { kind, tier, energyAmount, amountUSD } = req.body;

      if (!process.env.TON_WALLET_ADDRESS) {
        return res.status(500).json({ 
          ok: false, 
          error: "Payment system not configured. Please contact support." 
        });
      }

      const tonRate = await getTonPrice();
      const amountTON = convertUSDToTON(amountUSD, tonRate);

      const payment = await storage.createPayment({
        userId,
        kind,
        tier,
        energyAmount,
        amountUSD: amountUSD.toString(),
        amountTON: (parseFloat(amountTON) / 1_000_000_000).toString(),
        txHash: `pending_${Date.now()}`,
        status: "pending",
      });

      res.json({
        ok: true,
        data: {
          paymentId: payment.id,
          walletAddress: process.env.TON_WALLET_ADDRESS,
          amountTON,
          payload: payment.id,
        },
      });
    } catch (error: any) {
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
      
      await storage.updateUserEnergy(userId, validated.energy);
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
    status: z.enum(["active", "cancelled", "expired"]),
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
            energy: user.energy + payment.energyAmount,
          });
        }
      } else if (payment.kind === "subscription" && payment.tier) {
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
      }

      res.json({ ok: true });
    } catch (error: any) {
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
