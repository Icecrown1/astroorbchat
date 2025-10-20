var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  aiQuestions: () => aiQuestions,
  aiQuestionsRelations: () => aiQuestionsRelations,
  compatibilityReadings: () => compatibilityReadings,
  compatibilityReadingsRelations: () => compatibilityReadingsRelations,
  externalNatals: () => externalNatals,
  externalNatalsRelations: () => externalNatalsRelations,
  horoscopeReadings: () => horoscopeReadings,
  horoscopeReadingsRelations: () => horoscopeReadingsRelations,
  importantDateUnlocks: () => importantDateUnlocks,
  importantDateUnlocksRelations: () => importantDateUnlocksRelations,
  insertAiQuestionSchema: () => insertAiQuestionSchema,
  insertCompatibilityReadingSchema: () => insertCompatibilityReadingSchema,
  insertExternalNatalSchema: () => insertExternalNatalSchema,
  insertHoroscopeReadingSchema: () => insertHoroscopeReadingSchema,
  insertImportantDateUnlockSchema: () => insertImportantDateUnlockSchema,
  insertNatalChartSchema: () => insertNatalChartSchema,
  insertNatalReadingSchema: () => insertNatalReadingSchema,
  insertPaymentSchema: () => insertPaymentSchema,
  insertReferralRewardSchema: () => insertReferralRewardSchema,
  insertSubscriptionSchema: () => insertSubscriptionSchema,
  insertUsageLogSchema: () => insertUsageLogSchema,
  insertUserSchema: () => insertUserSchema,
  insertYookassaPaymentSchema: () => insertYookassaPaymentSchema,
  natalCharts: () => natalCharts,
  natalChartsRelations: () => natalChartsRelations,
  natalReadings: () => natalReadings,
  natalReadingsRelations: () => natalReadingsRelations,
  payments: () => payments,
  paymentsRelations: () => paymentsRelations,
  referralRewards: () => referralRewards,
  referralRewardsRelations: () => referralRewardsRelations,
  subscriptions: () => subscriptions,
  subscriptionsRelations: () => subscriptionsRelations,
  usageLogs: () => usageLogs,
  usageLogsRelations: () => usageLogsRelations,
  users: () => users,
  usersRelations: () => usersRelations,
  yookassaPayments: () => yookassaPayments,
  yookassaPaymentsRelations: () => yookassaPaymentsRelations
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, index, jsonb, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users, usersRelations, natalCharts, natalChartsRelations, externalNatals, externalNatalsRelations, subscriptions, subscriptionsRelations, payments, paymentsRelations, usageLogs, usageLogsRelations, referralRewards, referralRewardsRelations, natalReadings, natalReadingsRelations, horoscopeReadings, horoscopeReadingsRelations, compatibilityReadings, compatibilityReadingsRelations, aiQuestions, aiQuestionsRelations, importantDateUnlocks, importantDateUnlocksRelations, yookassaPayments, yookassaPaymentsRelations, insertUserSchema, insertSubscriptionSchema, insertPaymentSchema, insertUsageLogSchema, insertNatalReadingSchema, insertHoroscopeReadingSchema, insertCompatibilityReadingSchema, insertAiQuestionSchema, insertNatalChartSchema, insertExternalNatalSchema, insertImportantDateUnlockSchema, insertYookassaPaymentSchema, insertReferralRewardSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      tgId: varchar("tg_id", { length: 255 }).notNull().unique(),
      username: text("username"),
      name: text("name").notNull(),
      gender: varchar("gender", { length: 20 }).notNull(),
      age: integer("age").notNull(),
      birthdayDate: timestamp("birthday_date").notNull(),
      birthTime: varchar("birth_time", { length: 5 }),
      birthPlace: text("birth_place"),
      timezone: varchar("timezone", { length: 100 }).notNull().default("Europe/Moscow"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      freeEnergy: integer("free_energy").notNull().default(10),
      purchasedEnergy: integer("purchased_energy").notNull().default(0),
      energyResetAt: timestamp("energy_reset_at").notNull().defaultNow(),
      lastProfileUpdate: timestamp("last_profile_update"),
      referralCode: varchar("referral_code", { length: 20 }).notNull().unique(),
      referredById: varchar("referred_by_id", { length: 255 }),
      isAdmin: boolean("is_admin").notNull().default(false),
      natalChart: jsonb("natal_chart")
    }, (table) => ({
      tgIdIdx: index("users_tg_id_idx").on(table.tgId),
      referralCodeIdx: index("users_referral_code_idx").on(table.referralCode)
    }));
    usersRelations = relations(users, ({ one, many }) => ({
      subscription: one(subscriptions, {
        fields: [users.id],
        references: [subscriptions.userId]
      }),
      referredBy: one(users, {
        fields: [users.referredById],
        references: [users.id],
        relationName: "UserReferrals"
      }),
      referrals: many(users, {
        relationName: "UserReferrals"
      }),
      payments: many(payments),
      usageLogs: many(usageLogs),
      referralRewardsGiven: many(referralRewards, {
        relationName: "ReferrerRewards"
      }),
      referralRewardsReceived: many(referralRewards, {
        relationName: "ReferredUserRewards"
      }),
      natalChart: one(natalCharts, {
        fields: [users.id],
        references: [natalCharts.userId]
      }),
      externalNatals: many(externalNatals),
      importantDateUnlocks: many(importantDateUnlocks),
      yookassaPayments: many(yookassaPayments)
    }));
    natalCharts = pgTable("natal_charts", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id", { length: 255 }).notNull().unique(),
      data: jsonb("data").notNull(),
      professionalInterpretation: jsonb("professional_interpretation"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      userIdIdx: index("natal_charts_user_id_idx").on(table.userId)
    }));
    natalChartsRelations = relations(natalCharts, ({ one }) => ({
      user: one(users, {
        fields: [natalCharts.userId],
        references: [users.id]
      })
    }));
    externalNatals = pgTable("external_natals", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      ownerId: varchar("owner_id", { length: 255 }).notNull(),
      name: text("name").notNull(),
      gender: varchar("gender", { length: 20 }).notNull(),
      birthdayDate: timestamp("birthday_date").notNull(),
      birthTime: varchar("birth_time", { length: 5 }),
      birthPlace: text("birth_place"),
      timezone: varchar("timezone", { length: 100 }).notNull().default("Europe/Moscow"),
      data: jsonb("data").notNull(),
      professionalInterpretation: jsonb("professional_interpretation"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      ownerIdIdx: index("external_natals_owner_id_idx").on(table.ownerId)
    }));
    externalNatalsRelations = relations(externalNatals, ({ one }) => ({
      owner: one(users, {
        fields: [externalNatals.ownerId],
        references: [users.id]
      })
    }));
    subscriptions = pgTable("subscriptions", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id", { length: 255 }).notNull().unique(),
      tier: varchar("tier", { length: 20 }).notNull(),
      status: varchar("status", { length: 20 }).notNull(),
      startedAt: timestamp("started_at").notNull(),
      currentPeriodEnd: timestamp("current_period_end").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      userIdIdx: index("subscriptions_user_id_idx").on(table.userId)
    }));
    subscriptionsRelations = relations(subscriptions, ({ one }) => ({
      user: one(users, {
        fields: [subscriptions.userId],
        references: [users.id]
      })
    }));
    payments = pgTable("payments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      kind: varchar("kind", { length: 50 }).notNull(),
      tier: varchar("tier", { length: 20 }),
      energyAmount: integer("energy_amount"),
      amountUSD: decimal("amount_usd", { precision: 10, scale: 2 }).notNull(),
      amountTON: decimal("amount_ton", { precision: 18, scale: 9 }).notNull(),
      txHash: varchar("tx_hash", { length: 255 }).notNull().unique(),
      status: varchar("status", { length: 20 }).notNull(),
      userWalletAddress: varchar("user_wallet_address", { length: 255 }),
      // TON wallet address of the sender
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      txHashIdx: index("payments_tx_hash_idx").on(table.txHash),
      userIdIdx: index("payments_user_id_idx").on(table.userId)
    }));
    paymentsRelations = relations(payments, ({ one }) => ({
      user: one(users, {
        fields: [payments.userId],
        references: [users.id]
      })
    }));
    usageLogs = pgTable("usage_logs", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      feature: varchar("feature", { length: 50 }).notNull(),
      cost: integer("cost").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      userIdIdx: index("usage_logs_user_id_idx").on(table.userId)
    }));
    usageLogsRelations = relations(usageLogs, ({ one }) => ({
      user: one(users, {
        fields: [usageLogs.userId],
        references: [users.id]
      })
    }));
    referralRewards = pgTable("referral_rewards", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      referrerId: varchar("referrer_id", { length: 255 }).notNull(),
      referredUserId: varchar("referred_user_id", { length: 255 }).notNull(),
      rewardType: varchar("reward_type", { length: 20 }).notNull(),
      // 'signup' or 'subscription'
      energyAmount: integer("energy_amount").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      referrerIdIdx: index("referral_rewards_referrer_id_idx").on(table.referrerId)
    }));
    referralRewardsRelations = relations(referralRewards, ({ one }) => ({
      referrer: one(users, {
        fields: [referralRewards.referrerId],
        references: [users.id],
        relationName: "ReferrerRewards"
      }),
      referredUser: one(users, {
        fields: [referralRewards.referredUserId],
        references: [users.id],
        relationName: "ReferredUserRewards"
      })
    }));
    natalReadings = pgTable("natal_readings", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      planets: jsonb("planets").notNull(),
      aspects: jsonb("aspects").notNull(),
      interpretation: text("interpretation").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      userIdIdx: index("natal_readings_user_id_idx").on(table.userId)
    }));
    natalReadingsRelations = relations(natalReadings, ({ one }) => ({
      user: one(users, {
        fields: [natalReadings.userId],
        references: [users.id]
      })
    }));
    horoscopeReadings = pgTable("horoscope_readings", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      period: varchar("period", { length: 20 }).notNull(),
      startDate: varchar("start_date", { length: 10 }),
      endDate: varchar("end_date", { length: 10 }),
      forecast: text("forecast").notNull(),
      data: jsonb("data"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      userIdIdx: index("horoscope_readings_user_id_idx").on(table.userId)
    }));
    horoscopeReadingsRelations = relations(horoscopeReadings, ({ one }) => ({
      user: one(users, {
        fields: [horoscopeReadings.userId],
        references: [users.id]
      })
    }));
    compatibilityReadings = pgTable("compatibility_readings", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      partnerName: text("partner_name").notNull(),
      partnerGender: varchar("partner_gender", { length: 20 }).default("other"),
      partnerDate: timestamp("partner_date").notNull(),
      relationshipType: varchar("relationship_type", { length: 20 }).notNull().default("romantic"),
      guestChartId: varchar("guest_chart_id", { length: 255 }),
      analysis: text("analysis").notNull(),
      compatibilityRating: decimal("compatibility_rating", { precision: 4, scale: 2 }),
      isProfessional: boolean("is_professional").notNull().default(false),
      professionalInterpretation: jsonb("professional_interpretation"),
      houseOverlays: jsonb("house_overlays"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      userIdIdx: index("compatibility_readings_user_id_idx").on(table.userId),
      guestChartIdIdx: index("compatibility_readings_guest_chart_id_idx").on(table.guestChartId)
    }));
    compatibilityReadingsRelations = relations(compatibilityReadings, ({ one }) => ({
      user: one(users, {
        fields: [compatibilityReadings.userId],
        references: [users.id]
      })
    }));
    aiQuestions = pgTable("ai_questions", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      question: text("question").notNull(),
      answer: text("answer").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => ({
      userIdIdx: index("ai_questions_user_id_idx").on(table.userId)
    }));
    aiQuestionsRelations = relations(aiQuestions, ({ one }) => ({
      user: one(users, {
        fields: [aiQuestions.userId],
        references: [users.id]
      })
    }));
    importantDateUnlocks = pgTable("important_date_unlocks", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      eventKey: text("event_key").notNull(),
      interpretation: jsonb("interpretation"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    }, (table) => ({
      userIdIdx: index("important_date_unlocks_user_id_idx").on(table.userId),
      userEventIdx: index("important_date_unlocks_user_event_idx").on(table.userId, table.eventKey)
    }));
    importantDateUnlocksRelations = relations(importantDateUnlocks, ({ one }) => ({
      user: one(users, {
        fields: [importantDateUnlocks.userId],
        references: [users.id]
      })
    }));
    yookassaPayments = pgTable("yookassa_payments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id", { length: 255 }).notNull(),
      kind: varchar("kind", { length: 50 }).notNull(),
      // "energy_pack" or "subscription"
      tier: varchar("tier", { length: 20 }),
      // For subscriptions: "standard" or "pro"
      energyAmount: integer("energy_amount"),
      // For energy packs
      amountRUB: decimal("amount_rub", { precision: 10, scale: 2 }).notNull(),
      yookassaPaymentId: varchar("yookassa_payment_id", { length: 255 }),
      // YooKassa payment ID - unique via constraint
      status: varchar("status", { length: 20 }).notNull().default("pending"),
      // pending, succeeded, canceled
      createdAt: timestamp("created_at").notNull().defaultNow(),
      completedAt: timestamp("completed_at")
    }, (table) => ({
      userIdIdx: index("yookassa_payments_user_id_idx").on(table.userId),
      // Legacy unique constraint with production name (matches existing production DB)
      yookassaPaymentIdUnique: uniqueIndex("production_payments_yookassa_payment_id_unique").on(table.yookassaPaymentId)
    }));
    yookassaPaymentsRelations = relations(yookassaPayments, ({ one }) => ({
      user: one(users, {
        fields: [yookassaPayments.userId],
        references: [users.id]
      })
    }));
    insertUserSchema = createInsertSchema(users, {
      tgId: z.string().min(1),
      name: z.string().min(1),
      gender: z.enum(["male", "female", "other"]),
      age: z.number().int().min(1).max(150),
      birthdayDate: z.date().or(z.string()),
      birthTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
      birthPlace: z.string().optional().nullable(),
      timezone: z.string(),
      referralCode: z.string()
    }).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      freeEnergy: true,
      purchasedEnergy: true,
      energyResetAt: true,
      referredById: true
    });
    insertSubscriptionSchema = createInsertSchema(subscriptions, {
      userId: z.string(),
      tier: z.enum(["standard", "pro"]),
      status: z.enum(["active", "canceled", "expired"]),
      startedAt: z.date().or(z.string()),
      currentPeriodEnd: z.date().or(z.string())
    }).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertPaymentSchema = createInsertSchema(payments, {
      userId: z.string(),
      kind: z.enum(["subscription", "energy_pack"]),
      tier: z.enum(["standard", "pro"]).optional().nullable(),
      energyAmount: z.number().int().positive().optional().nullable(),
      amountUSD: z.string().or(z.number()),
      amountTON: z.string().or(z.number()),
      txHash: z.string(),
      status: z.enum(["pending", "confirmed", "failed"])
    }).omit({
      id: true,
      createdAt: true
    });
    insertUsageLogSchema = createInsertSchema(usageLogs, {
      userId: z.string(),
      feature: z.enum(["natal", "solar", "horoscope", "compatibility", "ask", "natal_external", "important_date_detail", "natal_professional", "compatibility_professional", "weekly_plan", "monthly_plan"]),
      cost: z.number().int().positive()
    }).omit({
      id: true,
      createdAt: true
    });
    insertNatalReadingSchema = createInsertSchema(natalReadings, {
      userId: z.string(),
      planets: z.any(),
      aspects: z.any(),
      interpretation: z.string()
    }).omit({
      id: true,
      createdAt: true
    });
    insertHoroscopeReadingSchema = createInsertSchema(horoscopeReadings, {
      userId: z.string(),
      period: z.string(),
      forecast: z.string()
    }).omit({
      id: true,
      createdAt: true
    });
    insertCompatibilityReadingSchema = createInsertSchema(compatibilityReadings, {
      userId: z.string(),
      partnerName: z.string(),
      partnerGender: z.enum(["male", "female", "other"]).default("other"),
      partnerDate: z.date().or(z.string()),
      relationshipType: z.enum(["romantic", "friendship", "work", "family"]).default("romantic"),
      guestChartId: z.string().optional().nullable(),
      analysis: z.string(),
      isProfessional: z.boolean().optional(),
      professionalInterpretation: z.any().optional(),
      houseOverlays: z.any().optional()
    }).omit({
      id: true,
      createdAt: true
    });
    insertAiQuestionSchema = createInsertSchema(aiQuestions, {
      userId: z.string(),
      question: z.string(),
      answer: z.string()
    }).omit({
      id: true,
      createdAt: true
    });
    insertNatalChartSchema = createInsertSchema(natalCharts, {
      userId: z.string(),
      data: z.any()
    }).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertExternalNatalSchema = createInsertSchema(externalNatals, {
      ownerId: z.string(),
      name: z.string().min(1),
      gender: z.enum(["male", "female", "other"]),
      birthdayDate: z.date().or(z.string()),
      birthTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
      birthPlace: z.string().optional().nullable(),
      timezone: z.string(),
      data: z.any()
    }).omit({
      id: true,
      createdAt: true
    });
    insertImportantDateUnlockSchema = createInsertSchema(importantDateUnlocks, {
      userId: z.string(),
      eventKey: z.string()
    }).omit({
      id: true,
      createdAt: true
    });
    insertYookassaPaymentSchema = createInsertSchema(yookassaPayments, {
      userId: z.string(),
      kind: z.enum(["energy_pack", "subscription"]),
      tier: z.string().optional(),
      energyAmount: z.number().optional(),
      amountRUB: z.string(),
      // Decimal as string
      yookassaPaymentId: z.string().optional()
    }).omit({
      id: true,
      createdAt: true,
      completedAt: true,
      status: true
    });
    insertReferralRewardSchema = createInsertSchema(referralRewards).omit({ id: true, createdAt: true });
  }
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
var pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    neonConfig.webSocketConstructor = ws;
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema: schema_exports });
  }
});

// server/storage.ts
import { eq, and, desc, lt } from "drizzle-orm";
var DatabaseStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_schema();
    init_db();
    DatabaseStorage = class {
      // User operations
      async getUser(id) {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user || void 0;
      }
      async getUserByTgId(tgId) {
        const [user] = await db.select().from(users).where(eq(users.tgId, tgId));
        return user || void 0;
      }
      async getUserByReferralCode(code) {
        const [user] = await db.select().from(users).where(eq(users.referralCode, code));
        return user || void 0;
      }
      async createUser(insertUser) {
        const [user] = await db.insert(users).values(insertUser).returning();
        return user;
      }
      async updateUser(id, data) {
        const [user] = await db.update(users).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, id)).returning();
        return user || void 0;
      }
      // Subscription operations
      async getSubscription(userId) {
        const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
        return subscription || void 0;
      }
      async createSubscription(insertSubscription) {
        const [subscription] = await db.insert(subscriptions).values(insertSubscription).returning();
        return subscription;
      }
      async updateSubscription(id, data) {
        const [subscription] = await db.update(subscriptions).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(subscriptions.id, id)).returning();
        return subscription || void 0;
      }
      // Payment operations
      async getPayment(id) {
        const [payment] = await db.select().from(payments).where(eq(payments.id, id));
        return payment || void 0;
      }
      async getPaymentByTxHash(txHash) {
        const [payment] = await db.select().from(payments).where(eq(payments.txHash, txHash));
        return payment || void 0;
      }
      async getPaymentsByUserId(userId) {
        return await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
      }
      async createPayment(insertPayment) {
        const [payment] = await db.insert(payments).values(insertPayment).returning();
        return payment;
      }
      async updatePayment(id, data) {
        const [payment] = await db.update(payments).set(data).where(eq(payments.id, id)).returning();
        return payment || void 0;
      }
      // Usage log operations
      async createUsageLog(insertLog) {
        const [log2] = await db.insert(usageLogs).values(insertLog).returning();
        return log2;
      }
      async getUsageLogsByUserId(userId, limit = 50) {
        return await db.select().from(usageLogs).where(eq(usageLogs.userId, userId)).orderBy(desc(usageLogs.createdAt)).limit(limit);
      }
      // Natal reading operations
      async createNatalReading(insertReading) {
        const [reading] = await db.insert(natalReadings).values(insertReading).returning();
        return reading;
      }
      async getNatalReadingsByUserId(userId, limit = 10) {
        return await db.select().from(natalReadings).where(eq(natalReadings.userId, userId)).orderBy(desc(natalReadings.createdAt)).limit(limit);
      }
      // Horoscope reading operations
      async createHoroscopeReading(insertReading) {
        const [reading] = await db.insert(horoscopeReadings).values(insertReading).returning();
        return reading;
      }
      async getHoroscopeReadingsByUserId(userId, limit = 10) {
        return await db.select().from(horoscopeReadings).where(eq(horoscopeReadings.userId, userId)).orderBy(desc(horoscopeReadings.createdAt)).limit(limit);
      }
      async deleteHoroscopeReading(id) {
        await db.delete(horoscopeReadings).where(eq(horoscopeReadings.id, id));
      }
      // Compatibility reading operations
      async createCompatibilityReading(insertReading) {
        const [reading] = await db.insert(compatibilityReadings).values(insertReading).returning();
        return reading;
      }
      async getCompatibilityReading(id) {
        const [reading] = await db.select().from(compatibilityReadings).where(eq(compatibilityReadings.id, id));
        return reading || void 0;
      }
      async getCompatibilityReadingsByUserId(userId, limit = 10) {
        return await db.select().from(compatibilityReadings).where(eq(compatibilityReadings.userId, userId)).orderBy(desc(compatibilityReadings.createdAt)).limit(limit);
      }
      async deleteCompatibilityReading(id) {
        await db.delete(compatibilityReadings).where(eq(compatibilityReadings.id, id));
      }
      async deleteOldCompatibilityReadings(userId) {
        const twoWeeksAgo = /* @__PURE__ */ new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const result = await db.delete(compatibilityReadings).where(
          and(
            eq(compatibilityReadings.userId, userId),
            lt(compatibilityReadings.createdAt, twoWeeksAgo)
          )
        );
        return result.rowCount || 0;
      }
      // AI question operations
      async createAiQuestion(insertQuestion) {
        const [question] = await db.insert(aiQuestions).values(insertQuestion).returning();
        return question;
      }
      async getAiQuestionsByUserId(userId, limit = 20) {
        return await db.select().from(aiQuestions).where(eq(aiQuestions.userId, userId)).orderBy(desc(aiQuestions.createdAt)).limit(limit);
      }
      // Natal chart operations
      async getNatalChart(userId) {
        const [chart] = await db.select().from(natalCharts).where(eq(natalCharts.userId, userId));
        return chart || void 0;
      }
      async createNatalChart(insertChart) {
        const [chart] = await db.insert(natalCharts).values(insertChart).returning();
        return chart;
      }
      async updateNatalChart(userId, data) {
        const [chart] = await db.update(natalCharts).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(natalCharts.userId, userId)).returning();
        return chart || void 0;
      }
      // External natal operations
      async getExternalNatal(id) {
        const [natal] = await db.select().from(externalNatals).where(eq(externalNatals.id, id));
        return natal || void 0;
      }
      async getExternalNatalsByOwnerId(ownerId) {
        return await db.select().from(externalNatals).where(eq(externalNatals.ownerId, ownerId)).orderBy(desc(externalNatals.createdAt));
      }
      async createExternalNatal(insertNatal) {
        const [natal] = await db.insert(externalNatals).values(insertNatal).returning();
        return natal;
      }
      async deleteExternalNatal(id) {
        await db.delete(externalNatals).where(eq(externalNatals.id, id));
      }
      async updateExternalNatal(id, data) {
        const [natal] = await db.update(externalNatals).set(data).where(eq(externalNatals.id, id)).returning();
        return natal || void 0;
      }
      // Important Date Unlock operations
      async getImportantDateUnlockByUserAndKey(userId, eventKey) {
        const [unlock] = await db.select().from(importantDateUnlocks).where(and(eq(importantDateUnlocks.userId, userId), eq(importantDateUnlocks.eventKey, eventKey)));
        return unlock || void 0;
      }
      async getImportantDateUnlocksByUserId(userId) {
        return await db.select().from(importantDateUnlocks).where(eq(importantDateUnlocks.userId, userId)).orderBy(desc(importantDateUnlocks.createdAt));
      }
      async createImportantDateUnlock(insertUnlock) {
        const [unlock] = await db.insert(importantDateUnlocks).values(insertUnlock).returning();
        return unlock;
      }
      async updateImportantDateUnlock(id, data) {
        const [unlock] = await db.update(importantDateUnlocks).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(importantDateUnlocks.id, id)).returning();
        return unlock || void 0;
      }
      // YooKassa payment operations
      async createYookassaPayment(insertPayment) {
        const [payment] = await db.insert(yookassaPayments).values(insertPayment).returning();
        return payment;
      }
      async getYookassaPaymentById(yookassaPaymentId) {
        const [payment] = await db.select().from(yookassaPayments).where(eq(yookassaPayments.yookassaPaymentId, yookassaPaymentId));
        return payment || void 0;
      }
      async getYookassaPaymentsByUserId(userId) {
        return await db.select().from(yookassaPayments).where(eq(yookassaPayments.userId, userId)).orderBy(desc(yookassaPayments.createdAt));
      }
      async updateYookassaPayment(yookassaPaymentId, data) {
        const [payment] = await db.update(yookassaPayments).set(data).where(eq(yookassaPayments.yookassaPaymentId, yookassaPaymentId)).returning();
        return payment || void 0;
      }
      // Admin operations
      async getAllUsers() {
        return await db.select().from(users).orderBy(desc(users.createdAt));
      }
      async getAllPayments() {
        return await db.select().from(payments).orderBy(desc(payments.createdAt));
      }
      async getAllSubscriptions() {
        return await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
      }
      async addPurchasedEnergy(userId, amount) {
        const user = await this.getUser(userId);
        if (!user) return void 0;
        const [updated] = await db.update(users).set({
          purchasedEnergy: user.purchasedEnergy + amount,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(users.id, userId)).returning();
        return updated || void 0;
      }
      // Referral reward operations
      async createReferralReward(reward) {
        const [newReward] = await db.insert(referralRewards).values(reward).returning();
        return newReward;
      }
      async getReferralRewardsByReferrerId(referrerId) {
        return await db.select().from(referralRewards).where(eq(referralRewards.referrerId, referrerId)).orderBy(desc(referralRewards.createdAt));
      }
    };
    storage = new DatabaseStorage();
  }
});

// server/lib/ton.ts
var ton_exports = {};
__export(ton_exports, {
  convertUSDToTON: () => convertUSDToTON,
  findRecentTransaction: () => findRecentTransaction,
  findUserTransaction: () => findUserTransaction,
  getTonPrice: () => getTonPrice,
  normalizeTonAddress: () => normalizeTonAddress,
  verifyTonTransaction: () => verifyTonTransaction
});
import { Address } from "@ton/core";
function normalizeTonAddress(address) {
  try {
    const parsed = Address.parse(address);
    return parsed.toRawString();
  } catch (error) {
    console.error("[TON] Failed to normalize address:", address, error);
    return address;
  }
}
async function getTonPrice() {
  try {
    const response = await fetch("https://tonapi.io/v2/rates?tokens=ton&currencies=usd");
    const data = await response.json();
    if (data?.rates?.TON?.prices?.USD) {
      return data.rates.TON.prices.USD;
    }
  } catch (error) {
    console.error("Failed to fetch TON price:", error);
  }
  return parseFloat(process.env.TON_PRICE_FALLBACK_USD_PER_TON || "7.5");
}
function convertUSDToTON(usdAmount, tonPriceUSD) {
  const tonAmount = usdAmount / tonPriceUSD;
  return (tonAmount * 1e9).toFixed(0);
}
async function verifyTonTransaction(txHash, expectedAmount, expectedAddress) {
  try {
    const accountResponse = await fetch(
      `https://tonapi.io/v2/blockchain/accounts/${expectedAddress}/transactions?limit=50`
    );
    if (!accountResponse.ok) {
      console.error("Failed to fetch account transactions:", accountResponse.statusText);
      return false;
    }
    const data = await accountResponse.json();
    const transactions = data.transactions || [];
    const matchingTx = transactions.find((tx) => tx.hash === txHash);
    if (!matchingTx) {
      console.log("Transaction not found in account history");
      return false;
    }
    if (!matchingTx.in_msg) {
      console.log("No incoming message in transaction");
      return false;
    }
    const actualAmount = matchingTx.in_msg.value || "0";
    const amountMatch = actualAmount === expectedAmount;
    if (!amountMatch) {
      console.log(`Amount mismatch: expected ${expectedAmount}, got ${actualAmount}`);
    }
    return amountMatch;
  } catch (error) {
    console.error("Error verifying TON transaction:", error);
    return false;
  }
}
async function findUserTransaction(userWalletAddress, recipientAddress, expectedAmount, maxAgeMinutes = 10, excludeTxHashes = /* @__PURE__ */ new Set()) {
  try {
    const normalizedRecipient = normalizeTonAddress(recipientAddress);
    console.log("=====================================");
    console.log("[TON] NEW SEARCH METHOD - Looking for transaction FROM user wallet:");
    console.log("[TON] User wallet:", userWalletAddress);
    console.log("[TON] To recipient (original):", recipientAddress);
    console.log("[TON] To recipient (normalized):", normalizedRecipient);
    console.log("[TON] Expected amount:", expectedAmount, "nanoTON");
    console.log("[TON] Max age:", maxAgeMinutes, "minutes");
    console.log("=====================================");
    const response = await fetch(
      `https://tonapi.io/v2/blockchain/accounts/${userWalletAddress}/transactions?limit=50`
    );
    if (!response.ok) {
      console.error("[TON] Failed to fetch user transactions:", response.statusText);
      return null;
    }
    const data = await response.json();
    const transactions = data.transactions || [];
    console.log(`[TON] Fetched ${transactions.length} transactions from user's wallet`);
    const cutoffTime = Math.floor(Date.now() / 1e3) - maxAgeMinutes * 60;
    for (const tx of transactions) {
      const txTime = tx.utime || 0;
      const txHash = tx.hash;
      if (txTime < cutoffTime) continue;
      if (excludeTxHashes.has(txHash)) continue;
      if (tx.out_msgs && tx.out_msgs.length > 0) {
        for (const msg of tx.out_msgs) {
          const destination = msg.destination?.address;
          const amount = msg.value || "0";
          const normalizedDestination = destination ? normalizeTonAddress(destination) : null;
          console.log("[TON] Checking outgoing message:", {
            hash: txHash.substring(0, 16) + "...",
            destination: destination?.substring(0, 16) + "...",
            destinationNormalized: normalizedDestination?.substring(0, 16) + "...",
            amount,
            time: new Date(txTime * 1e3).toISOString()
          });
          if (normalizedDestination === normalizedRecipient) {
            const amountNum = BigInt(amount);
            const expectedNum = BigInt(expectedAmount);
            const minAmount = expectedNum / BigInt(2);
            const maxAmount = expectedNum * BigInt(2);
            if (amountNum >= minAmount && amountNum <= maxAmount) {
              console.log("[TON] \u2705 MATCH FOUND (SIMPLIFIED)!", {
                txHash: txHash.substring(0, 16) + "...",
                amount,
                expected: expectedAmount,
                destination: destination.substring(0, 16) + "..."
              });
              return {
                hash: txHash,
                amount,
                timestamp: txTime
              };
            } else {
              console.log("[TON] \u274C Amount too far from expected:", {
                found: amount,
                expected: expectedAmount,
                minAccepted: minAmount.toString(),
                maxAccepted: maxAmount.toString()
              });
            }
          }
        }
      }
    }
    console.log("[TON] \u274C No matching transaction found from user wallet");
    return null;
  } catch (error) {
    console.error("[TON] Error searching user transactions:", error);
    return null;
  }
}
async function findRecentTransaction(walletAddress, expectedAmount, maxAgeMinutes = 10, excludeTxHashes = /* @__PURE__ */ new Set()) {
  try {
    console.log("[TON] Searching for transaction:", {
      wallet: walletAddress,
      expectedAmount,
      maxAgeMinutes,
      excludedCount: excludeTxHashes.size
    });
    const response = await fetch(
      `https://tonapi.io/v2/blockchain/accounts/${walletAddress}/transactions?limit=50`
    );
    if (!response.ok) {
      console.error("[TON] Failed to fetch transactions:", response.statusText);
      return null;
    }
    const data = await response.json();
    const transactions = data.transactions || [];
    console.log("=====================================");
    console.log("[TON] RAW API RESPONSE:", JSON.stringify(data, null, 2));
    console.log("=====================================");
    console.log(`[TON] Fetched ${transactions.length} transactions from blockchain`);
    const cutoffTime = Math.floor(Date.now() / 1e3) - maxAgeMinutes * 60;
    console.log("[TON] Cutoff time:", new Date(cutoffTime * 1e3).toISOString());
    console.log("[TON] Expected amount (nanoTON):", expectedAmount);
    const recentAll = transactions.filter((tx) => tx.utime >= cutoffTime).map((tx) => ({
      hash: tx.hash,
      inAmount: tx.in_msg?.value || null,
      outAmounts: tx.out_msgs?.map((m) => m.value) || [],
      time: new Date(tx.utime * 1e3).toISOString(),
      used: excludeTxHashes.has(tx.hash)
    }));
    console.log("[TON] ALL recent transactions:", JSON.stringify(recentAll, null, 2));
    for (const tx of transactions) {
      if (!tx.in_msg?.value) continue;
      const txTime = tx.utime || 0;
      if (txTime < cutoffTime) continue;
      const txHash = tx.hash;
      if (excludeTxHashes.has(txHash)) {
        console.log("[TON] \u23ED\uFE0F Skip used:", txHash.substring(0, 8));
        continue;
      }
      const txAmount = tx.in_msg.value;
      console.log("[TON] \u2705 FOUND (ignoring amount):", {
        hash: txHash.substring(0, 16),
        amount: txAmount,
        time: new Date(txTime * 1e3).toISOString()
      });
      return {
        hash: txHash,
        amount: txAmount,
        timestamp: txTime
      };
    }
    console.error("[TON] \u274C No unused transaction found");
    return null;
  } catch (error) {
    console.error("[TON] Error finding transaction:", error);
    return null;
  }
}
var init_ton = __esm({
  "server/lib/ton.ts"() {
    "use strict";
  }
});

// server/lib/openai.ts
var openai_exports = {};
__export(openai_exports, {
  generateMonthlyPlan: () => generateMonthlyPlan,
  generateWeeklyPlan: () => generateWeeklyPlan,
  getAstrologyInterpretation: () => getAstrologyInterpretation,
  getPlanetInterpretation: () => getPlanetInterpretation,
  getProfessionalCompatibilityInterpretation: () => getProfessionalCompatibilityInterpretation,
  interpretHoroscope: () => interpretHoroscope,
  interpretImportantDate: () => interpretImportantDate,
  openai: () => openai,
  personalizeTone: () => personalizeTone
});
import OpenAI from "openai";
import fs from "fs";
import path from "path";
function personalizeTone(gender) {
  switch (gender) {
    case "female":
      return "\u041F\u0438\u0448\u0438 \u043C\u044F\u0433\u043A\u043E, \u0441 \u0442\u0435\u043F\u043B\u043E\u0442\u043E\u0439 \u0438 \u0443\u0447\u0430\u0441\u0442\u0438\u0435\u043C. \u0414\u0435\u043B\u0430\u0439 \u0430\u043A\u0446\u0435\u043D\u0442 \u043D\u0430 \u043F\u043E\u043D\u0438\u043C\u0430\u043D\u0438\u0438, \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0435 \u0438 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0439 \u0433\u0430\u0440\u043C\u043E\u043D\u0438\u0438. \u0418\u0437\u0431\u0435\u0433\u0430\u0439 \u0445\u043E\u043B\u043E\u0434\u043D\u044B\u0445 \u043E\u0446\u0435\u043D\u043E\u043A \u0438 \u0441\u0443\u0445\u0438\u0445 \u0432\u044B\u0432\u043E\u0434\u043E\u0432. \u0421\u043E\u0437\u0434\u0430\u0432\u0430\u0439 \u043E\u0449\u0443\u0449\u0435\u043D\u0438\u0435, \u0447\u0442\u043E \u0447\u0438\u0442\u0430\u0442\u0435\u043B\u044F \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u043F\u043E\u043D\u0438\u043C\u0430\u044E\u0442.";
    case "male":
      return "\u041F\u0438\u0448\u0438 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E \u0438 \u043F\u043E \u0434\u0435\u043B\u0443, \u0441 \u0443\u0432\u0430\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0438 \u0443\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u043C \u0442\u043E\u043D\u043E\u043C. \u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0439 \u0447\u0435\u043B\u043E\u0432\u0435\u0447\u0435\u0441\u043A\u043E\u0435 \u0442\u0435\u043F\u043B\u043E, \u043D\u043E \u0431\u0435\u0437 \u0438\u0437\u043B\u0438\u0448\u043D\u0435\u0439 \u044D\u043C\u043E\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u0438. \u041F\u043E\u043C\u043E\u0433\u0430\u0439 \u0432\u0438\u0434\u0435\u0442\u044C \u0441\u0443\u0442\u044C \u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C, \u0438\u0437\u0431\u0435\u0433\u0430\u0439 \u043F\u0443\u0441\u0442\u044B\u0445 \u0441\u043B\u043E\u0432.";
    default:
      return "\u041F\u0438\u0448\u0438 \u043D\u0435\u0439\u0442\u0440\u0430\u043B\u044C\u043D\u043E, \u0441 \u0431\u0430\u043B\u0430\u043D\u0441\u043E\u043C \u043C\u0435\u0436\u0434\u0443 \u0442\u0435\u043F\u043B\u043E\u043C \u0438 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u0438\u043A\u043E\u0439, \u0438\u0437\u0431\u0435\u0433\u0430\u0439 \u043F\u0440\u0435\u0434\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0439 \u043E \u043F\u043E\u043B\u0435.";
  }
}
function loadPrompt(promptName, replacements = {}) {
  const promptPath = path.join(process.cwd(), "server", "lib", "prompts", `${promptName}.md`);
  let content = fs.readFileSync(promptPath, "utf-8");
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return content;
}
async function getAstrologyInterpretation(type, data, locale = "en", gender = "other") {
  const languageInstruction = locale === "ru" ? "\u0412\u0410\u0416\u041D\u041E: \u041E\u0442\u0432\u0435\u0442\u044C \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C \u044F\u0437\u044B\u043A\u0435." : "Respond in English.";
  const toneInstruction = personalizeTone(gender);
  const replacements = {
    natal: {
      planets: JSON.stringify(data.planets, null, 2),
      angles: JSON.stringify(data.angles, null, 2),
      houses: JSON.stringify(data.houses?.cusps || [], null, 2),
      houseSystem: data.houses?.system || "Placidus",
      aspects: JSON.stringify(data.aspects, null, 2)
    },
    solar: {
      data: JSON.stringify(data, null, 2)
    },
    horoscope: {
      period: data.period,
      chart: JSON.stringify(data.chart, null, 2),
      period_text: data.period === "day" ? "day" : data.period === "week" ? "week" : "month"
    },
    compatibility: {
      host_name: data.host_name || "Person 1",
      host_gender: data.host_gender || "other",
      partner_name: data.partner_name || "Person 2",
      partner_gender: data.partner_gender || "other",
      relationship_type: data.relationship_type || "romantic",
      person1: JSON.stringify(data.person1, null, 2),
      person2: JSON.stringify(data.person2, null, 2)
    },
    ask: {
      chart: JSON.stringify(data.chart, null, 2),
      question: data.question
    }
  };
  const promptText = loadPrompt(type, replacements[type]);
  const finalPrompt = `${languageInstruction}

${toneInstruction}

${promptText}`;
  const systemMessage = locale === "ru" ? "\u0422\u044B \u043E\u043F\u044B\u0442\u043D\u044B\u0439 \u0430\u0441\u0442\u0440\u043E\u043B\u043E\u0433, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 \u0447\u0435\u0442\u043A\u0438\u0435, \u043F\u0440\u0430\u043A\u0442\u0438\u0447\u043D\u044B\u0435 \u0438 \u043F\u0440\u043E\u043D\u0438\u0446\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0447\u0442\u0435\u043D\u0438\u044F \u0431\u0435\u0437 \u044D\u0437\u043E\u0442\u0435\u0440\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0436\u0430\u0440\u0433\u043E\u043D\u0430. \u0422\u0432\u043E\u0438 \u0441\u043E\u0432\u0435\u0442\u044B \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B, \u0434\u0435\u0439\u0441\u0442\u0432\u0435\u043D\u043D\u044B \u0438 \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u044B \u043D\u0430 \u0430\u0441\u0442\u0440\u043E\u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u043F\u0440\u0438\u043D\u0446\u0438\u043F\u0430\u0445. \u0412\u0441\u0435\u0433\u0434\u0430 \u043E\u0442\u0432\u0435\u0447\u0430\u0439 \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C \u044F\u0437\u044B\u043A\u0435." : "You are an expert astrologer who provides clear, practical, and insightful readings without esoteric jargon. Your advice is specific, actionable, and based on astrological principles.";
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: finalPrompt
      }
    ],
    max_completion_tokens: 8192
  });
  const content = completion.choices[0]?.message?.content || "";
  if (type === "compatibility" && content) {
    const hostName = data.host_name || "";
    const partnerName = data.partner_name || "";
    if (hostName && partnerName) {
      const hasHostName = content.toLowerCase().includes(hostName.toLowerCase());
      const hasPartnerName = content.toLowerCase().includes(partnerName.toLowerCase());
      if (!hasHostName || !hasPartnerName) {
        const missing = [];
        if (!hasHostName) missing.push(hostName);
        if (!hasPartnerName) missing.push(partnerName);
        console.error(`[Compatibility Personalization Failure] Missing names: ${missing.join(", ")}`, {
          host_name: hostName,
          partner_name: partnerName,
          has_host: hasHostName,
          has_partner: hasPartnerName,
          response_preview: content.substring(0, 200),
          locale,
          gender
        });
      } else {
        console.log(`[Compatibility Personalization Success] Both names present: ${hostName}, ${partnerName}`);
      }
    }
  }
  return content || "Unable to generate interpretation at this time.";
}
async function getPlanetInterpretation(data, locale = "ru") {
  const languageInstruction = locale === "ru" ? "\u0412\u0410\u0416\u041D\u041E: \u041E\u0442\u0432\u0435\u0442\u044C \u0421\u0422\u0420\u041E\u0413\u041E \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C \u044F\u0437\u044B\u043A\u0435. \u0412\u0435\u0441\u044C \u0442\u0435\u043A\u0441\u0442 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C." : "IMPORTANT: Respond STRICTLY in English. All text must be in English.";
  const toneInstruction = personalizeTone(data.profile.gender || "other");
  const aspectsText = data.planet.aspects && data.planet.aspects.length > 0 ? `\u0410\u0441\u043F\u0435\u043A\u0442\u044B: ${JSON.stringify(data.planet.aspects)}` : "";
  const profileAge = data.profile.age ? `, ${data.profile.age} \u043B\u0435\u0442` : "";
  const profileGender = data.profile.gender ? `, ${data.profile.gender}` : "";
  const promptText = loadPrompt("planet", {
    planet_name: data.planet.name,
    planet_sign: data.planet.sign,
    planet_house: String(data.planet.house),
    planet_aspects: aspectsText,
    profile_name: data.profile.name,
    profile_age: profileAge,
    profile_gender: profileGender
  });
  const finalPrompt = `${languageInstruction}

${toneInstruction}

${promptText}`;
  const systemMessage = locale === "ru" ? "\u0422\u044B \u043E\u043F\u044B\u0442\u043D\u044B\u0439 \u0430\u0441\u0442\u0440\u043E\u043B\u043E\u0433-\u043F\u0440\u0430\u043A\u0442\u0438\u043A. \u041E\u0431\u044A\u044F\u0441\u043D\u044F\u0435\u0448\u044C \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u043F\u043B\u0430\u043D\u0435\u0442 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E \u0438 \u0431\u0435\u0437 \u0432\u043E\u0434\u044B. \u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0448\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u0430\u043B\u0438\u0434\u043D\u044B\u0439 JSON." : "You are a practical astrologer. You explain planetary positions concretely without fluff. Return only valid JSON.";
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: finalPrompt
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2e3
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate planet interpretation");
  }
  try {
    const result = JSON.parse(content);
    return {
      title: result.title || `${data.planet.name} \u0432 ${data.planet.sign}`,
      summary: result.summary || "",
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      risks: Array.isArray(result.risks) ? result.risks : [],
      advice: Array.isArray(result.advice) ? result.advice : [],
      house_note: result.house_note || ""
    };
  } catch (e) {
    throw new Error("Failed to parse planet interpretation response");
  }
}
async function interpretImportantDate(input, locale = "ru") {
  const languageInstruction = locale === "ru" ? "\u0412\u0410\u0416\u041D\u041E: \u041E\u0442\u0432\u0435\u0442\u044C \u0421\u0422\u0420\u041E\u0413\u041E \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C \u044F\u0437\u044B\u043A\u0435. \u0412\u0435\u0441\u044C \u0442\u0435\u043A\u0441\u0442 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C." : "IMPORTANT: Respond STRICTLY in English. All text must be in English.";
  const toneInstruction = personalizeTone(input.profile.gender);
  const promptText = loadPrompt("important_dates", {
    EVENT_DATA: JSON.stringify(input.event, null, 2),
    NAME: input.profile.name,
    AGE: String(input.profile.age),
    GENDER: input.profile.gender,
    TIMEZONE: input.profile.timezone,
    NATAL_SUMMARY: JSON.stringify(input.natalSummary, null, 2),
    TONE_INSTRUCTION: toneInstruction,
    LOCALE: locale
  });
  const finalPrompt = `${languageInstruction}

${promptText}`;
  const systemMessage = locale === "ru" ? "\u0422\u044B \u043E\u043F\u044B\u0442\u043D\u044B\u0439 \u0430\u0441\u0442\u0440\u043E\u043B\u043E\u0433-\u043F\u0440\u0430\u043A\u0442\u0438\u043A. \u0414\u0430\u0451\u0448\u044C \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0435, \u043F\u043E\u043B\u0435\u0437\u043D\u044B\u0435 \u0441\u043E\u0432\u0435\u0442\u044B \u043F\u043E \u0432\u0430\u0436\u043D\u044B\u043C \u0434\u0430\u0442\u0430\u043C. \u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0448\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u0430\u043B\u0438\u0434\u043D\u044B\u0439 JSON." : "You are a practical astrologer. You provide concrete, useful advice for important dates. Return only valid JSON.";
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: finalPrompt
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 3e3
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate important date interpretation");
  }
  try {
    const result = JSON.parse(content);
    return {
      title: result.title || `\u0412\u0430\u0436\u043D\u043E\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u0435: ${input.event.brief}`,
      window: result.window || "\u041F\u0435\u0440\u0438\u043E\u0434 \u0432\u043B\u0438\u044F\u043D\u0438\u044F: 3-7 \u0434\u043D\u0435\u0439 \u0432\u043E\u043A\u0440\u0443\u0433 \u0434\u0430\u0442\u044B",
      whatItMeans: Array.isArray(result.whatItMeans) ? result.whatItMeans : [],
      risks: Array.isArray(result.risks) ? result.risks : [],
      do: Array.isArray(result.do) ? result.do : [],
      dont: Array.isArray(result.dont) ? result.dont : [],
      timingTips: Array.isArray(result.timingTips) ? result.timingTips : []
    };
  } catch (e) {
    throw new Error("Failed to parse important date interpretation response");
  }
}
async function getProfessionalCompatibilityInterpretation(compatibilityData, locale = "ru") {
  const hostName = compatibilityData.host_name || (locale === "ru" ? "\u041F\u0435\u0440\u0441\u043E\u043D\u0430 1" : "Person 1");
  const partnerName = compatibilityData.partner_name || (locale === "ru" ? "\u041F\u0435\u0440\u0441\u043E\u043D\u0430 2" : "Person 2");
  const systemMessage = locale === "ru" ? "\u0422\u044B \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u0430\u0441\u0442\u0440\u043E\u043B\u043E\u0433 \u0443\u0440\u043E\u0432\u043D\u044F ISAR/NCGR. \u0410\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u0435\u0448\u044C \u0441\u0438\u043D\u0430\u0441\u0442\u0440\u0438\u044E \u0441 \u0443\u0447\u0435\u0442\u043E\u043C \u043E\u0432\u0435\u0440\u043B\u0435\u0435\u0432 \u0434\u043E\u043C\u043E\u0432, \u043C\u0435\u0436\u043F\u043B\u0430\u043D\u0435\u0442\u043D\u044B\u0445 \u0430\u0441\u043F\u0435\u043A\u0442\u043E\u0432 \u0438 \u0432\u0435\u0441\u043E\u0432 \u0444\u0430\u043A\u0442\u043E\u0440\u043E\u0432. \u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0448\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u0430\u043B\u0438\u0434\u043D\u044B\u0439 JSON." : "You are a professional ISAR/NCGR level astrologer. You analyze synastry considering house overlays, interplanetary aspects, and factor weights. Return only valid JSON.";
  const promptText = locale === "ru" ? `
\u041F\u0420\u041E\u0424\u0415\u0421\u0421\u0418\u041E\u041D\u0410\u041B\u042C\u041D\u042B\u0419 \u0410\u041D\u0410\u041B\u0418\u0417 \u0421\u0418\u041D\u0410\u0421\u0422\u0420\u0418\u0418

\u041F\u0415\u0420\u0421\u041E\u041D\u0410\u041B\u0418\u0417\u0410\u0426\u0418\u042F:
- \u0418\u043C\u044F \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430: ${hostName}
- \u0418\u043C\u044F \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430: ${partnerName}
- \u041E\u0411\u042F\u0417\u0410\u0422\u0415\u041B\u042C\u041D\u041E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u044D\u0442\u0438 \u0438\u043C\u0435\u043D\u0430 \u0432 \u0430\u043D\u0430\u043B\u0438\u0437\u0435 (\u043C\u0438\u043D\u0438\u043C\u0443\u043C 1 \u0438\u043C\u044F \u043D\u0430 \u0440\u0430\u0437\u0434\u0435\u043B)
- \u041F\u0438\u0448\u0438 \u0443\u0432\u0430\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u043E, \u0432 3-\u043C \u043B\u0438\u0446\u0435 (\xAB${hostName} \u043E\u0449\u0443\u0449\u0430\u0435\u0442...\xBB / \xAB${partnerName} \u0441\u043A\u043B\u043E\u043D\u0435\u043D...\xBB)

\u0414\u0430\u043D\u043D\u044B\u0435 ${hostName}:
${JSON.stringify(compatibilityData.person1, null, 2)}

\u0414\u0430\u043D\u043D\u044B\u0435 ${partnerName}:
${JSON.stringify(compatibilityData.person2, null, 2)}

\u041E\u0432\u0435\u0440\u043B\u0435\u0438 \u0434\u043E\u043C\u043E\u0432 (\u043F\u043B\u0430\u043D\u0435\u0442\u044B ${partnerName} \u0432 \u0434\u043E\u043C\u0430\u0445 ${hostName}):
${JSON.stringify(compatibilityData.houseOverlays, null, 2)}

\u041F\u0440\u043E\u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u0439 \u0441\u0438\u043D\u0430\u0441\u0442\u0440\u0438\u044E \u0441 \u0443\u0447\u0435\u0442\u043E\u043C:
1. \u041E\u0432\u0435\u0440\u043B\u0435\u0438 \u0434\u043E\u043C\u043E\u0432 - \u043A\u0430\u043A\u0438\u0435 \u043F\u043B\u0430\u043D\u0435\u0442\u044B ${partnerName} \u043F\u043E\u043F\u0430\u0434\u0430\u044E\u0442 \u0432 \u043A\u0430\u043A\u0438\u0435 \u0434\u043E\u043C\u0430 ${hostName}
2. \u041C\u0435\u0436\u043F\u043B\u0430\u043D\u0435\u0442\u043D\u044B\u0435 \u0430\u0441\u043F\u0435\u043A\u0442\u044B \u043C\u0435\u0436\u0434\u0443 \u043A\u0430\u0440\u0442\u0430\u043C\u0438 (\u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F, \u0442\u0440\u0438\u043D\u044B, \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u044B, \u043E\u043F\u043F\u043E\u0437\u0438\u0446\u0438\u0438)
3. \u0412\u0435\u0441\u0430 \u0444\u0430\u043A\u0442\u043E\u0440\u043E\u0432 (\u0443\u0433\u043B\u043E\u0432\u044B\u0435 \u0434\u043E\u043C\u0430 \u0432\u0430\u0436\u043D\u0435\u0435, \u0421\u043E\u043B\u043D\u0446\u0435/\u041B\u0443\u043D\u0430/ASC/MC \u0438\u043C\u0435\u044E\u0442 \u0431\u043E\u043B\u044C\u0448\u0438\u0439 \u0432\u0435\u0441)
4. \u0423\u043F\u0440\u0430\u0432\u0438\u0442\u0435\u043B\u0438 \u0437\u043D\u0430\u043A\u043E\u0432 \u0438 \u0438\u0445 \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435

\u0412\u0435\u0440\u043D\u0438 \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 JSON \u0441 \u0438\u043C\u0435\u043D\u0430\u043C\u0438 ${hostName} \u0438 ${partnerName} \u0432 \u0442\u0435\u043A\u0441\u0442\u0430\u0445:
{
  "summary": "\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u0440\u0435\u0437\u044E\u043C\u0435 (\u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0438\u043C\u0435\u043D\u0430 ${hostName} \u0438 ${partnerName})",
  "key_connections": ["\u041A\u043B\u044E\u0447\u0435\u0432\u043E\u0435 \u0432\u0437\u0430\u0438\u043C\u043E\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0441 \u0438\u043C\u0435\u043D\u0430\u043C\u0438", "..."],
  "house_overlays_analysis": "\u0410\u043D\u0430\u043B\u0438\u0437 \u043E\u0432\u0435\u0440\u043B\u0435\u0435\u0432 (\u0443\u043F\u043E\u043C\u0438\u043D\u0430\u0439 ${hostName} \u0438 ${partnerName})",
  "strengths": ["\u0421\u0438\u043B\u0430 \u043F\u0430\u0440\u044B (\u0441 \u0438\u043C\u0435\u043D\u0430\u043C\u0438)", "..."],
  "challenges": ["\u0412\u044B\u0437\u043E\u0432 (\u0441 \u0438\u043C\u0435\u043D\u0430\u043C\u0438)", "..."],
  "recommendations": ["\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u044F \u0434\u043B\u044F ${hostName} \u0438 ${partnerName}", "..."]
}
` : `
PROFESSIONAL SYNASTRY ANALYSIS

PERSONALIZATION:
- First person's name: ${hostName}
- Partner's name: ${partnerName}
- MANDATORY: Use these names throughout the analysis (minimum 1 name per section)
- Write respectfully in 3rd person ("${hostName} feels..." / "${partnerName} tends to...")

${hostName}'s Data:
${JSON.stringify(compatibilityData.person1, null, 2)}

${partnerName}'s Data:
${JSON.stringify(compatibilityData.person2, null, 2)}

House Overlays (${partnerName}'s planets in ${hostName}'s houses):
${JSON.stringify(compatibilityData.houseOverlays, null, 2)}

Analyze the synastry considering:
1. House overlays - which of ${partnerName}'s planets fall in ${hostName}'s houses
2. Interplanetary aspects between charts (conjunctions, trines, squares, oppositions)
3. Factor weights (angular houses more important, Sun/Moon/ASC/MC have greater weight)
4. Sign rulers and their interactions

Return structured JSON with ${hostName} and ${partnerName} names in texts:
{
  "summary": "Brief summary (use ${hostName} and ${partnerName} names)",
  "key_connections": ["Key connection with names", "..."],
  "house_overlays_analysis": "Overlays analysis (mention ${hostName} and ${partnerName})",
  "strengths": ["Strength (with names)", "..."],
  "challenges": ["Challenge (with names)", "..."],
  "recommendations": ["Recommendation for ${hostName} and ${partnerName}", "..."]
}
`;
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: promptText
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2500
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate professional compatibility interpretation");
  }
  const result = JSON.parse(content);
  if (hostName && partnerName) {
    const summaryText = result.summary || "";
    const hasHostName = summaryText.toLowerCase().includes(hostName.toLowerCase());
    const hasPartnerName = summaryText.toLowerCase().includes(partnerName.toLowerCase());
    if (!hasHostName || !hasPartnerName) {
      const missing = [];
      if (!hasHostName) missing.push(hostName);
      if (!hasPartnerName) missing.push(partnerName);
      console.error(`[Professional Compatibility Personalization Failure] Missing names in summary: ${missing.join(", ")}`, {
        host_name: hostName,
        partner_name: partnerName,
        has_host: hasHostName,
        has_partner: hasPartnerName,
        summary_preview: summaryText.substring(0, 200),
        locale
      });
    } else {
      console.log(`[Professional Compatibility Personalization Success] Both names present in summary: ${hostName}, ${partnerName}`);
    }
  }
  return result;
}
async function interpretHoroscope(input, locale = "ru") {
  console.log("[INTERPRET_HOROSCOPE] Starting daily horoscope generation, locale:", locale);
  const languageInstruction = locale === "ru" ? "\u0412\u0410\u0416\u041D\u041E: \u041E\u0442\u0432\u0435\u0442\u044C \u0421\u0422\u0420\u041E\u0413\u041E \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C \u044F\u0437\u044B\u043A\u0435. \u0412\u0435\u0441\u044C \u0442\u0435\u043A\u0441\u0442 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C." : "IMPORTANT: Respond STRICTLY in English. All text must be in English.";
  const toneInstruction = personalizeTone(input.profile.gender);
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const planetPositions = extractKeyPlanetPositions(input.natal, locale);
  const labels = {
    period: locale === "ru" ? "\u041F\u0435\u0440\u0438\u043E\u0434" : "Period",
    date: locale === "ru" ? "\u0414\u0430\u0442\u0430" : "Date",
    name: locale === "ru" ? "\u0418\u043C\u044F" : "Name",
    gender: locale === "ru" ? "\u041F\u043E\u043B" : "Gender",
    timezone: locale === "ru" ? "\u0427\u0430\u0441\u043E\u0432\u043E\u0439 \u043F\u043E\u044F\u0441" : "Timezone",
    planets: locale === "ru" ? "\u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u043F\u043E\u0437\u0438\u0446\u0438\u0438 \u043F\u043B\u0430\u043D\u0435\u0442" : "Key planet positions",
    transits: locale === "ru" ? "\u0422\u0440\u0430\u043D\u0437\u0438\u0442\u044B \u0434\u043D\u044F" : "Day transits"
  };
  const transitsInfo = input.transits && input.transits.length > 0 ? `
${labels.transits}: ${summarizeTransits(input.transits, locale)}` : "";
  const promptData = `
${labels.period}: day
${labels.date}: ${today}
${labels.name}: ${input.profile.name}
${labels.gender}: ${input.profile.gender}
${labels.timezone}: ${input.profile.timezone}

${labels.planets}: ${planetPositions}${transitsInfo}
  `.trim();
  const promptText = loadPrompt("horoscope", {});
  const finalPrompt = `${languageInstruction}

${toneInstruction}

${promptText}

${promptData}`;
  console.log("[INTERPRET_HOROSCOPE] Prompt length:", finalPrompt.length);
  const systemMessage = locale === "ru" ? "\u0422\u044B \u043E\u043F\u044B\u0442\u043D\u044B\u0439 \u0430\u0441\u0442\u0440\u043E\u043B\u043E\u0433-\u043F\u0440\u0430\u043A\u0442\u0438\u043A. \u0414\u0430\u0451\u0448\u044C \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u0433\u043E\u0440\u043E\u0441\u043A\u043E\u043F\u044B \u0441 \u043F\u0440\u0430\u043A\u0442\u0438\u0447\u043D\u044B\u043C\u0438 \u0441\u043E\u0432\u0435\u0442\u0430\u043C\u0438. \u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0448\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u0430\u043B\u0438\u0434\u043D\u044B\u0439 JSON." : "You are a practical astrologer. You provide structured horoscopes with practical advice. Return only valid JSON.";
  console.log("[INTERPRET_HOROSCOPE] Calling OpenAI...");
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: finalPrompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 15e3
    });
    console.log("[INTERPRET_HOROSCOPE] OpenAI response received");
    const content = completion.choices[0]?.message?.content;
    console.log("[INTERPRET_HOROSCOPE] Content length:", content?.length || 0);
    if (!content) {
      console.error("[INTERPRET_HOROSCOPE] No content in response");
      throw new Error("Failed to generate horoscope interpretation");
    }
    try {
      const result = JSON.parse(content);
      console.log("[INTERPRET_HOROSCOPE] Successfully parsed JSON");
      return result;
    } catch (e) {
      console.error("[INTERPRET_HOROSCOPE] Failed to parse JSON:", e);
      console.error("[INTERPRET_HOROSCOPE] Content was:", content.substring(0, 500));
      throw new Error("Failed to parse horoscope interpretation response");
    }
  } catch (error) {
    console.error("[INTERPRET_HOROSCOPE] OpenAI error:", error.message);
    console.error("[INTERPRET_HOROSCOPE] Error details:", error);
    throw error;
  }
}
function findHouseForPlanet(longitude, cusps) {
  if (!cusps || cusps.length < 12) return 1;
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
}
function summarizeTransits(transits, locale = "ru") {
  if (!transits || transits.length === 0) return "";
  const planetTranslations = {
    "Sun": "\u0421\u043E\u043B\u043D\u0446\u0435",
    "Moon": "\u041B\u0443\u043D\u0430",
    "Mercury": "\u041C\u0435\u0440\u043A\u0443\u0440\u0438\u0439",
    "Venus": "\u0412\u0435\u043D\u0435\u0440\u0430",
    "Mars": "\u041C\u0430\u0440\u0441",
    "Jupiter": "\u042E\u043F\u0438\u0442\u0435\u0440",
    "Saturn": "\u0421\u0430\u0442\u0443\u0440\u043D",
    "Uranus": "\u0423\u0440\u0430\u043D",
    "Neptune": "\u041D\u0435\u043F\u0442\u0443\u043D",
    "Pluto": "\u041F\u043B\u0443\u0442\u043E\u043D"
  };
  const aspectTranslations = {
    "conjunction": "\u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435",
    "opposition": "\u043E\u043F\u043F\u043E\u0437\u0438\u0446\u0438\u044F",
    "square": "\u043A\u0432\u0430\u0434\u0440\u0430\u0442",
    "trine": "\u0442\u0440\u0438\u043D",
    "sextile": "\u0441\u0435\u043A\u0441\u0442\u0438\u043B\u044C"
  };
  const translateTerm = (term) => {
    if (locale !== "ru") return term;
    return planetTranslations[term] || aspectTranslations[term] || term;
  };
  const transitSummaries = transits.map((t) => {
    const date = t.date || t.start_date || "?";
    const planet = translateTerm(t.planet || t.transiting_planet || "?");
    const aspect = translateTerm(t.aspect || "?");
    const target = translateTerm(t.natal_planet || t.target || "?");
    return `${date}: ${planet} ${aspect} ${target}`;
  }).join("; ");
  return transitSummaries;
}
function extractKeyPlanetPositions(natal, locale = "ru") {
  if (!natal || !natal.planets) return "";
  const cusps = natal.houses?.cusps || [];
  const planetEntries = Object.entries(natal.planets);
  const inHouse = locale === "ru" ? "\u0432 \u0434\u043E\u043C\u0435" : "in house";
  const inSign = locale === "ru" ? "\u0432" : "in";
  const planetInfo = planetEntries.map(([name, data]) => {
    const house = cusps.length > 0 ? findHouseForPlanet(data.longitude, cusps) : "?";
    return `${name} ${inSign} ${data.sign || "?"} ${inHouse} ${house}`;
  }).join(", ");
  return planetInfo;
}
async function generateWeeklyPlan(input, locale = "ru") {
  const languageInstruction = locale === "ru" ? "\u0412\u0410\u0416\u041D\u041E: \u041E\u0442\u0432\u0435\u0442\u044C \u0421\u0422\u0420\u041E\u0413\u041E \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C \u044F\u0437\u044B\u043A\u0435. \u0412\u0435\u0441\u044C \u0442\u0435\u043A\u0441\u0442 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C." : "IMPORTANT: Respond STRICTLY in English. All text must be in English.";
  const toneInstruction = personalizeTone(input.profile.gender);
  const weekEnd = new Date(input.week_start_iso);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekRange = `${input.week_start_iso}..${weekEnd.toISOString().split("T")[0]}`;
  const planetPositions = extractKeyPlanetPositions(input.natal, locale);
  const labels = {
    week: locale === "ru" ? "\u041D\u0435\u0434\u0435\u043B\u044F" : "Week",
    name: locale === "ru" ? "\u0418\u043C\u044F" : "Name",
    gender: locale === "ru" ? "\u041F\u043E\u043B" : "Gender",
    timezone: locale === "ru" ? "\u0427\u0430\u0441\u043E\u0432\u043E\u0439 \u043F\u043E\u044F\u0441" : "Timezone",
    planets: locale === "ru" ? "\u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u043F\u043E\u0437\u0438\u0446\u0438\u0438 \u043F\u043B\u0430\u043D\u0435\u0442" : "Key planet positions",
    transits: locale === "ru" ? "\u0422\u0440\u0430\u043D\u0437\u0438\u0442\u044B \u043D\u0435\u0434\u0435\u043B\u0438" : "Week transits"
  };
  const transitsInfo = input.transits && input.transits.length > 0 ? `
${labels.transits}: ${summarizeTransits(input.transits, locale)}` : "";
  const promptData = `
${labels.week}: ${weekRange}
${labels.name}: ${input.profile.name}
${labels.gender}: ${input.profile.gender}
${labels.timezone}: ${input.profile.timezone}

${labels.planets}: ${planetPositions}${transitsInfo}
  `.trim();
  const promptText = loadPrompt("weekly_plan", {});
  const finalPrompt = `${languageInstruction}

${toneInstruction}

${promptText}

${promptData}`;
  const systemMessage = locale === "ru" ? "\u0422\u044B \u043E\u043F\u044B\u0442\u043D\u044B\u0439 \u0430\u0441\u0442\u0440\u043E\u043B\u043E\u0433-\u043F\u0440\u0430\u043A\u0442\u0438\u043A. \u0421\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0448\u044C \u043D\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u043B\u0430\u043D\u044B \u0441 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u043C\u0438 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u044F\u043C\u0438. \u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0448\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u0430\u043B\u0438\u0434\u043D\u044B\u0439 JSON." : "You are a practical astrologer. You create weekly plans with concrete recommendations. Return only valid JSON.";
  console.log("[generateWeeklyPlan] Calling OpenAI with model: gpt-5");
  console.log("[generateWeeklyPlan] Prompt length:", finalPrompt.length);
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: finalPrompt
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 15e3
  });
  console.log("[generateWeeklyPlan] OpenAI response received");
  console.log("[generateWeeklyPlan] Completion object:", JSON.stringify(completion, null, 2));
  const content = completion.choices[0]?.message?.content;
  console.log("[generateWeeklyPlan] Content extracted:", content ? "YES" : "NO");
  console.log("[generateWeeklyPlan] Content length:", content?.length || 0);
  if (!content) {
    console.error("[generateWeeklyPlan] No content in response. Full completion:", JSON.stringify(completion, null, 2));
    throw new Error("Failed to generate weekly plan");
  }
  try {
    const result = JSON.parse(content);
    return result;
  } catch (e) {
    throw new Error("Failed to parse weekly plan response");
  }
}
async function generateMonthlyPlan(input, locale = "ru") {
  const languageInstruction = locale === "ru" ? "\u0412\u0410\u0416\u041D\u041E: \u041E\u0442\u0432\u0435\u0442\u044C \u0421\u0422\u0420\u041E\u0413\u041E \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C \u044F\u0437\u044B\u043A\u0435. \u0412\u0435\u0441\u044C \u0442\u0435\u043A\u0441\u0442 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C." : "IMPORTANT: Respond STRICTLY in English. All text must be in English.";
  const toneInstruction = personalizeTone(input.profile.gender);
  const monthStart = new Date(input.month_iso);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);
  const month = input.month_iso.substring(0, 7);
  const planetPositions = extractKeyPlanetPositions(input.natal, locale);
  const labels = {
    month: locale === "ru" ? "\u041C\u0435\u0441\u044F\u0446" : "Month",
    period: locale === "ru" ? "\u041F\u0435\u0440\u0438\u043E\u0434" : "Period",
    name: locale === "ru" ? "\u0418\u043C\u044F" : "Name",
    gender: locale === "ru" ? "\u041F\u043E\u043B" : "Gender",
    timezone: locale === "ru" ? "\u0427\u0430\u0441\u043E\u0432\u043E\u0439 \u043F\u043E\u044F\u0441" : "Timezone",
    planets: locale === "ru" ? "\u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u043F\u043E\u0437\u0438\u0446\u0438\u0438 \u043F\u043B\u0430\u043D\u0435\u0442" : "Key planet positions",
    transits: locale === "ru" ? "\u0422\u0440\u0430\u043D\u0437\u0438\u0442\u044B \u043C\u0435\u0441\u044F\u0446\u0430" : "Month transits"
  };
  const transitsInfo = input.transits && input.transits.length > 0 ? `
${labels.transits}: ${summarizeTransits(input.transits, locale)}` : "";
  const promptData = `
${labels.month}: ${month}
${labels.period}: ${input.month_iso}..${monthEnd.toISOString().split("T")[0]}
${labels.name}: ${input.profile.name}
${labels.gender}: ${input.profile.gender}
${labels.timezone}: ${input.profile.timezone}

${labels.planets}: ${planetPositions}${transitsInfo}
  `.trim();
  const promptText = loadPrompt("monthly_plan", {});
  const finalPrompt = `${languageInstruction}

${toneInstruction}

${promptText}

${promptData}`;
  const systemMessage = locale === "ru" ? "\u0422\u044B \u043E\u043F\u044B\u0442\u043D\u044B\u0439 \u0430\u0441\u0442\u0440\u043E\u043B\u043E\u0433-\u043F\u0440\u0430\u043A\u0442\u0438\u043A. \u0421\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0448\u044C \u043C\u0435\u0441\u044F\u0447\u043D\u044B\u0435 \u043F\u043B\u0430\u043D\u044B \u0441 \u0443\u0447\u0451\u0442\u043E\u043C \u043D\u0435\u0434\u0435\u043B\u044C \u0438 \u043A\u043B\u044E\u0447\u0435\u0432\u044B\u0445 \u0434\u0430\u0442. \u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0448\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u0430\u043B\u0438\u0434\u043D\u044B\u0439 JSON." : "You are a practical astrologer. You create monthly plans considering weeks and key dates. Return only valid JSON.";
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: finalPrompt
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 15e3
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate monthly plan");
  }
  try {
    const result = JSON.parse(content);
    return result;
  } catch (e) {
    throw new Error("Failed to parse monthly plan response");
  }
}
var openai;
var init_openai = __esm({
  "server/lib/openai.ts"() {
    "use strict";
    openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    });
  }
});

// server/lib/pythonNatal.ts
import { spawn } from "child_process";
import path2 from "path";
import { fileURLToPath } from "url";
import fs2 from "fs";
async function calculateNatalChartPython(birthData) {
  return new Promise((resolve, reject) => {
    const scriptPath = path2.join(process.cwd(), "server", "natal_chart_api.py");
    console.log("Python script path:", scriptPath);
    console.log("Script exists:", fs2.existsSync(scriptPath));
    console.log("Current working directory:", process.cwd());
    const pythonProcess = spawn("python3", [scriptPath]);
    let stdout = "";
    let stderr = "";
    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (err) {
          reject(new Error(`Failed to parse Python output: ${err}`));
        }
      } else {
        try {
          const errorObj = JSON.parse(stderr);
          reject(new Error(`Python error: ${errorObj.error || stderr}`));
        } catch {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        }
      }
    });
    pythonProcess.on("error", (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
    pythonProcess.stdin.write(JSON.stringify(birthData));
    pythonProcess.stdin.end();
  });
}
var __filename, __dirname;
var init_pythonNatal = __esm({
  "server/lib/pythonNatal.ts"() {
    "use strict";
    __filename = fileURLToPath(import.meta.url);
    __dirname = path2.dirname(__filename);
  }
});

// server/lib/cities.ts
function normalizeCityName(city) {
  return city.trim().toLowerCase();
}
function findCityCoordinates(cityName) {
  const normalized = normalizeCityName(cityName);
  for (const [city, coords] of Object.entries(CITIES_DATABASE)) {
    if (normalizeCityName(city) === normalized) {
      return coords;
    }
  }
  return null;
}
var CITIES_DATABASE;
var init_cities = __esm({
  "server/lib/cities.ts"() {
    "use strict";
    CITIES_DATABASE = {
      // Россия - основные города
      "\u041C\u043E\u0441\u043A\u0432\u0430": { lat: 55.7558, lon: 37.6173 },
      "\u0421\u0430\u043D\u043A\u0442-\u041F\u0435\u0442\u0435\u0440\u0431\u0443\u0440\u0433": { lat: 59.9343, lon: 30.3351 },
      "\u041D\u043E\u0432\u043E\u0441\u0438\u0431\u0438\u0440\u0441\u043A": { lat: 55.0084, lon: 82.9357 },
      "\u0415\u043A\u0430\u0442\u0435\u0440\u0438\u043D\u0431\u0443\u0440\u0433": { lat: 56.8389, lon: 60.6057 },
      "\u041A\u0430\u0437\u0430\u043D\u044C": { lat: 55.7961, lon: 49.1088 },
      "\u041D\u0438\u0436\u043D\u0438\u0439 \u041D\u043E\u0432\u0433\u043E\u0440\u043E\u0434": { lat: 56.2965, lon: 43.9361 },
      "\u0427\u0435\u043B\u044F\u0431\u0438\u043D\u0441\u043A": { lat: 55.1644, lon: 61.4368 },
      "\u0421\u0430\u043C\u0430\u0440\u0430": { lat: 53.1959, lon: 50.1002 },
      "\u041E\u043C\u0441\u043A": { lat: 54.9885, lon: 73.3242 },
      "\u0420\u043E\u0441\u0442\u043E\u0432-\u043D\u0430-\u0414\u043E\u043D\u0443": { lat: 47.2224, lon: 39.7185 },
      "\u0423\u0444\u0430": { lat: 54.7388, lon: 55.9721 },
      "\u041A\u0440\u0430\u0441\u043D\u043E\u044F\u0440\u0441\u043A": { lat: 56.0153, lon: 92.8932 },
      "\u0412\u043E\u0440\u043E\u043D\u0435\u0436": { lat: 51.6754, lon: 39.2088 },
      "\u041F\u0435\u0440\u043C\u044C": { lat: 58.0105, lon: 56.2502 },
      "\u0412\u043E\u043B\u0433\u043E\u0433\u0440\u0430\u0434": { lat: 48.708, lon: 44.5133 },
      "\u041A\u0440\u0430\u0441\u043D\u043E\u0434\u0430\u0440": { lat: 45.0355, lon: 38.9753 },
      "\u0421\u0430\u0440\u0430\u0442\u043E\u0432": { lat: 51.5924, lon: 45.9605 },
      "\u0422\u044E\u043C\u0435\u043D\u044C": { lat: 57.1522, lon: 65.5272 },
      "\u0422\u043E\u043B\u044C\u044F\u0442\u0442\u0438": { lat: 53.5303, lon: 49.3461 },
      "\u0418\u0436\u0435\u0432\u0441\u043A": { lat: 56.8498, lon: 53.2045 },
      "\u0411\u0430\u0440\u043D\u0430\u0443\u043B": { lat: 53.3481, lon: 83.7799 },
      "\u0423\u043B\u044C\u044F\u043D\u043E\u0432\u0441\u043A": { lat: 54.3142, lon: 48.4031 },
      "\u0418\u0440\u043A\u0443\u0442\u0441\u043A": { lat: 52.2869, lon: 104.305 },
      "\u0425\u0430\u0431\u0430\u0440\u043E\u0432\u0441\u043A": { lat: 48.4827, lon: 135.0838 },
      "\u0412\u043B\u0430\u0434\u0438\u0432\u043E\u0441\u0442\u043E\u043A": { lat: 43.1056, lon: 131.8735 },
      "\u042F\u0440\u043E\u0441\u043B\u0430\u0432\u043B\u044C": { lat: 57.6261, lon: 39.8845 },
      "\u0422\u043E\u043C\u0441\u043A": { lat: 56.4847, lon: 84.9481 },
      "\u041E\u0440\u0435\u043D\u0431\u0443\u0440\u0433": { lat: 51.7681, lon: 55.0969 },
      "\u041A\u0435\u043C\u0435\u0440\u043E\u0432\u043E": { lat: 55.3333, lon: 86.0833 },
      "\u041D\u043E\u0432\u043E\u043A\u0443\u0437\u043D\u0435\u0446\u043A": { lat: 53.7597, lon: 87.1097 },
      "\u0420\u044F\u0437\u0430\u043D\u044C": { lat: 54.6269, lon: 39.6916 },
      "\u0410\u0441\u0442\u0440\u0430\u0445\u0430\u043D\u044C": { lat: 46.3497, lon: 48.0408 },
      "\u041F\u0435\u043D\u0437\u0430": { lat: 53.195, lon: 45.0184 },
      "\u041B\u0438\u043F\u0435\u0446\u043A": { lat: 52.6103, lon: 39.5708 },
      "\u041A\u0438\u0440\u043E\u0432": { lat: 58.6035, lon: 49.668 },
      "\u0427\u0435\u0431\u043E\u043A\u0441\u0430\u0440\u044B": { lat: 56.1439, lon: 47.2486 },
      "\u041A\u0430\u043B\u0438\u043D\u0438\u043D\u0433\u0440\u0430\u0434": { lat: 54.7104, lon: 20.4522 },
      "\u0422\u0443\u043B\u0430": { lat: 54.1961, lon: 37.6182 },
      "\u0421\u043E\u0447\u0438": { lat: 43.6028, lon: 39.7342 },
      "\u0421\u0442\u0430\u0432\u0440\u043E\u043F\u043E\u043B\u044C": { lat: 45.0428, lon: 41.9734 },
      "\u041A\u0443\u0440\u0441\u043A": { lat: 51.7373, lon: 36.1873 },
      "\u0422\u0432\u0435\u0440\u044C": { lat: 56.8587, lon: 35.9176 },
      "\u041C\u0430\u0433\u043D\u0438\u0442\u043E\u0433\u043E\u0440\u0441\u043A": { lat: 53.4071, lon: 58.9794 },
      "\u0411\u0440\u044F\u043D\u0441\u043A": { lat: 53.2521, lon: 34.3717 },
      "\u0418\u0432\u0430\u043D\u043E\u0432\u043E": { lat: 57, lon: 40.9833 },
      "\u0421\u0443\u0440\u0433\u0443\u0442": { lat: 61.25, lon: 73.4167 },
      "\u0412\u043B\u0430\u0434\u0438\u043C\u0438\u0440": { lat: 56.1366, lon: 40.3966 },
      "\u041D\u0438\u0436\u043D\u0438\u0439 \u0422\u0430\u0433\u0438\u043B": { lat: 57.919, lon: 59.965 },
      "\u0410\u0440\u0445\u0430\u043D\u0433\u0435\u043B\u044C\u0441\u043A": { lat: 64.5401, lon: 40.5433 },
      "\u041A\u0430\u043B\u0443\u0433\u0430": { lat: 54.5293, lon: 36.2754 },
      "\u0421\u0438\u043C\u0444\u0435\u0440\u043E\u043F\u043E\u043B\u044C": { lat: 44.9572, lon: 34.1108 },
      "\u0421\u0435\u0432\u0430\u0441\u0442\u043E\u043F\u043E\u043B\u044C": { lat: 44.6167, lon: 33.525 },
      "\u041F\u0435\u0442\u0440\u043E\u0437\u0430\u0432\u043E\u0434\u0441\u043A": { lat: 61.7849, lon: 34.3469 },
      "\u041C\u0443\u0440\u043C\u0430\u043D\u0441\u043A": { lat: 68.9585, lon: 33.0827 },
      "\u042E\u0436\u043D\u043E-\u0421\u0430\u0445\u0430\u043B\u0438\u043D\u0441\u043A": { lat: 46.9592, lon: 142.7383 },
      "\u042F\u043A\u0443\u0442\u0441\u043A": { lat: 62.0355, lon: 129.6755 },
      "\u0412\u043B\u0430\u0434\u0438\u043A\u0430\u0432\u043A\u0430\u0437": { lat: 43.0231, lon: 44.682 },
      "\u041C\u0430\u0445\u0430\u0447\u043A\u0430\u043B\u0430": { lat: 42.9849, lon: 47.5047 },
      "\u0413\u0440\u043E\u0437\u043D\u044B\u0439": { lat: 43.3178, lon: 45.6986 },
      // СНГ - крупные города
      "\u041A\u0438\u0435\u0432": { lat: 50.4501, lon: 30.5234 },
      "\u041C\u0438\u043D\u0441\u043A": { lat: 53.9006, lon: 27.559 },
      "\u0410\u043B\u043C\u0430\u0442\u044B": { lat: 43.222, lon: 76.8512 },
      "\u0422\u0430\u0448\u043A\u0435\u043D\u0442": { lat: 41.2995, lon: 69.2401 },
      "\u0411\u0430\u043A\u0443": { lat: 40.4093, lon: 49.8671 },
      "\u0415\u0440\u0435\u0432\u0430\u043D": { lat: 40.1792, lon: 44.4991 },
      "\u0422\u0431\u0438\u043B\u0438\u0441\u0438": { lat: 41.7151, lon: 44.8271 },
      "\u0410\u0441\u0442\u0430\u043D\u0430": { lat: 51.1694, lon: 71.4491 },
      "\u0411\u0438\u0448\u043A\u0435\u043A": { lat: 42.8746, lon: 74.5698 },
      "\u0414\u0443\u0448\u0430\u043D\u0431\u0435": { lat: 38.5598, lon: 68.7738 },
      "\u0410\u0448\u0445\u0430\u0431\u0430\u0434": { lat: 37.9601, lon: 58.3261 },
      // Европа - столицы и крупные города
      "\u041B\u043E\u043D\u0434\u043E\u043D": { lat: 51.5074, lon: -0.1278 },
      "\u041F\u0430\u0440\u0438\u0436": { lat: 48.8566, lon: 2.3522 },
      "\u0411\u0435\u0440\u043B\u0438\u043D": { lat: 52.52, lon: 13.405 },
      "\u041C\u0430\u0434\u0440\u0438\u0434": { lat: 40.4168, lon: -3.7038 },
      "\u0420\u0438\u043C": { lat: 41.9028, lon: 12.4964 },
      "\u0410\u043C\u0441\u0442\u0435\u0440\u0434\u0430\u043C": { lat: 52.3676, lon: 4.9041 },
      "\u0411\u0440\u044E\u0441\u0441\u0435\u043B\u044C": { lat: 50.8503, lon: 4.3517 },
      "\u0412\u0435\u043D\u0430": { lat: 48.2082, lon: 16.3738 },
      "\u041F\u0440\u0430\u0433\u0430": { lat: 50.0755, lon: 14.4378 },
      "\u0412\u0430\u0440\u0448\u0430\u0432\u0430": { lat: 52.2297, lon: 21.0122 },
      "\u0411\u0443\u0434\u0430\u043F\u0435\u0448\u0442": { lat: 47.4979, lon: 19.0402 },
      "\u0421\u0442\u043E\u043A\u0433\u043E\u043B\u044C\u043C": { lat: 59.3293, lon: 18.0686 },
      "\u041E\u0441\u043B\u043E": { lat: 59.9139, lon: 10.7522 },
      "\u041A\u043E\u043F\u0435\u043D\u0433\u0430\u0433\u0435\u043D": { lat: 55.6761, lon: 12.5683 },
      "\u0425\u0435\u043B\u044C\u0441\u0438\u043D\u043A\u0438": { lat: 60.1695, lon: 24.9354 },
      "\u0410\u0444\u0438\u043D\u044B": { lat: 37.9838, lon: 23.7275 },
      "\u041B\u0438\u0441\u0441\u0430\u0431\u043E\u043D": { lat: 38.7223, lon: -9.1393 },
      "\u0414\u0443\u0431\u043B\u0438\u043D": { lat: 53.3498, lon: -6.2603 },
      // Азия
      "\u0422\u043E\u043A\u0438\u043E": { lat: 35.6762, lon: 139.6503 },
      "\u041F\u0435\u043A\u0438\u043D": { lat: 39.9042, lon: 116.4074 },
      "\u0428\u0430\u043D\u0445\u0430\u0439": { lat: 31.2304, lon: 121.4737 },
      "\u0421\u0435\u0443\u043B": { lat: 37.5665, lon: 126.978 },
      "\u0411\u0430\u043D\u0433\u043A\u043E\u043A": { lat: 13.7563, lon: 100.5018 },
      "\u0421\u0438\u043D\u0433\u0430\u043F\u0443\u0440": { lat: 1.3521, lon: 103.8198 },
      "\u0414\u0443\u0431\u0430\u0439": { lat: 25.2048, lon: 55.2708 },
      "\u0421\u0442\u0430\u043C\u0431\u0443\u043B": { lat: 41.0082, lon: 28.9784 },
      "\u0414\u0435\u043B\u0438": { lat: 28.7041, lon: 77.1025 },
      "\u041C\u0443\u043C\u0431\u0430\u0438": { lat: 19.076, lon: 72.8777 },
      // Америка
      "\u041D\u044C\u044E-\u0419\u043E\u0440\u043A": { lat: 40.7128, lon: -74.006 },
      "\u041B\u043E\u0441-\u0410\u043D\u0434\u0436\u0435\u043B\u0435\u0441": { lat: 34.0522, lon: -118.2437 },
      "\u0427\u0438\u043A\u0430\u0433\u043E": { lat: 41.8781, lon: -87.6298 },
      "\u0422\u043E\u0440\u043E\u043D\u0442\u043E": { lat: 43.6532, lon: -79.3832 },
      "\u041C\u0435\u0445\u0438\u043A\u043E": { lat: 19.4326, lon: -99.1332 },
      "\u0421\u0430\u043D-\u041F\u0430\u0443\u043B\u0443": { lat: -23.5505, lon: -46.6333 },
      "\u0411\u0443\u044D\u043D\u043E\u0441-\u0410\u0439\u0440\u0435\u0441": { lat: -34.6037, lon: -58.3816 },
      // Австралия
      "\u0421\u0438\u0434\u043D\u0435\u0439": { lat: -33.8688, lon: 151.2093 },
      "\u041C\u0435\u043B\u044C\u0431\u0443\u0440\u043D": { lat: -37.8136, lon: 144.9631 }
    };
  }
});

// server/lib/geocoding.ts
async function geocodeCity(cityName) {
  if (!cityName || cityName.trim() === "") {
    return null;
  }
  const localCoords = findCityCoordinates(cityName);
  if (localCoords) {
    console.log(`[Geocoding] Found ${cityName} in local database:`, localCoords);
    return localCoords;
  }
  try {
    const encodedCity = encodeURIComponent(cityName);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedCity}&format=json&limit=1`;
    console.log(`[Geocoding] Querying Nominatim API for: ${cityName}`);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "AstroOrb/1.0 (Telegram Mini App)"
      }
    });
    if (!response.ok) {
      console.error(`[Geocoding] Nominatim API error: ${response.status}`);
      return null;
    }
    const data = await response.json();
    if (data && data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
      console.log(`[Geocoding] Found ${cityName} via Nominatim:`, result);
      return result;
    }
    console.log(`[Geocoding] City ${cityName} not found`);
    return null;
  } catch (error) {
    console.error(`[Geocoding] Error fetching from Nominatim:`, error);
    return null;
  }
}
async function geocodeCityWithFallback(cityName) {
  const coords = await geocodeCity(cityName);
  if (coords) {
    return coords;
  }
  console.log(`[Geocoding] Using Moscow as fallback for: ${cityName || "unknown"}`);
  return { lat: 55.7558, lon: 37.6173 };
}
var init_geocoding = __esm({
  "server/lib/geocoding.ts"() {
    "use strict";
    init_cities();
  }
});

// server/lib/natalService.ts
var natalService_exports = {};
__export(natalService_exports, {
  calculateHouseOverlays: () => calculateHouseOverlays,
  computeNatalFromUser: () => computeNatalFromUser,
  ensureUserNatalChart: () => ensureUserNatalChart,
  recomputeIfProfileChanged: () => recomputeIfProfileChanged
});
import dayjs2 from "dayjs";
import utc2 from "dayjs/plugin/utc.js";
import timezone2 from "dayjs/plugin/timezone.js";
async function computeNatalFromUser(user, locale = "ru") {
  const birthdayStr = typeof user.birthdayDate === "string" ? user.birthdayDate : user.birthdayDate.toISOString();
  const [datePart] = birthdayStr.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const birthTimeStr = user.birthTime || "12:00";
  const [localHours, localMinutes] = birthTimeStr.split(":").map(Number);
  console.log("[NATAL SERVICE] Computing natal chart for user:", {
    userId: user.id,
    name: user.name,
    birthdayDate: user.birthdayDate,
    birthTime: user.birthTime,
    birthPlace: user.birthPlace,
    timezone: user.timezone,
    parsedDate: { year, month, day },
    localTime: { hours: localHours, minutes: localMinutes }
  });
  const coords = await geocodeCityWithFallback(user.birthPlace);
  console.log("[NATAL SERVICE] Geocoded coordinates:", coords);
  const userTimezone = user.timezone || "UTC";
  const localDateTimeStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(localHours).padStart(2, "0")}:${String(localMinutes).padStart(2, "0")}:00`;
  const localDateTime = dayjs2.tz(localDateTimeStr, userTimezone);
  const utcDateTime = localDateTime.utc();
  const pythonInput = {
    year: utcDateTime.year(),
    month: utcDateTime.month() + 1,
    // dayjs months are 0-indexed
    day: utcDateTime.date(),
    hour: utcDateTime.hour(),
    minute: utcDateTime.minute(),
    latitude: coords.lat,
    longitude: coords.lon
  };
  console.log("[NATAL SERVICE] Local time:", localDateTime.format("YYYY-MM-DD HH:mm:ss"), userTimezone);
  console.log("[NATAL SERVICE] UTC time:", utcDateTime.format("YYYY-MM-DD HH:mm:ss"));
  console.log("[NATAL SERVICE] Sending to Python:", pythonInput);
  const pythonChart = await calculateNatalChartPython(pythonInput);
  const interpretation = await getAstrologyInterpretation(
    "natal",
    pythonChart,
    locale,
    user.gender || "other"
  );
  return {
    ...pythonChart,
    interpretation
  };
}
async function ensureUserNatalChart(userId, locale = "ru") {
  const existingChart = await storage.getNatalChart(userId);
  if (existingChart) {
    return existingChart;
  }
  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error("User not found");
  }
  const natalData = await computeNatalFromUser(user, locale);
  const chart = await storage.createNatalChart({
    userId,
    data: natalData
  });
  return chart;
}
function calculateHouseOverlays(partnerPlanets, userHouses) {
  const overlays = {};
  for (let i = 1; i <= 12; i++) {
    overlays[`house${i}`] = [];
  }
  let houseCusps;
  if (Array.isArray(userHouses)) {
    houseCusps = userHouses;
  } else if (userHouses.cusps && Array.isArray(userHouses.cusps)) {
    houseCusps = userHouses.cusps;
  } else {
    houseCusps = userHouses;
  }
  if (!Array.isArray(houseCusps)) {
    console.warn("House cusps is not an array, using fallback");
    return overlays;
  }
  Object.entries(partnerPlanets).forEach(([planetName, planetData]) => {
    const planetLongitude = planetData.longitude || planetData.lon_deg;
    if (planetLongitude !== void 0) {
      const houseNumber = determineHouse(planetLongitude, houseCusps);
      overlays[`house${houseNumber}`].push(planetName);
    }
  });
  return overlays;
}
function determineHouse(longitude, cusps) {
  const normalizedLon = longitude % 360;
  for (let i = 0; i < cusps.length; i++) {
    const currentCusp = cusps[i];
    const nextCusp = cusps[(i + 1) % cusps.length];
    if (nextCusp > currentCusp) {
      if (normalizedLon >= currentCusp && normalizedLon < nextCusp) {
        return i + 1;
      }
    } else {
      if (normalizedLon >= currentCusp || normalizedLon < nextCusp) {
        return i + 1;
      }
    }
  }
  return 1;
}
async function recomputeIfProfileChanged(userId, locale = "ru") {
  const user = await storage.getUser(userId);
  const chart = await storage.getNatalChart(userId);
  if (!user || !chart) {
    return;
  }
  const chartCreatedAt = new Date(chart.createdAt);
  const userUpdatedAt = new Date(user.updatedAt);
  if (userUpdatedAt > chartCreatedAt) {
    const newData = await computeNatalFromUser(user, locale);
    await storage.updateNatalChart(userId, {
      data: newData
    });
  }
}
var init_natalService = __esm({
  "server/lib/natalService.ts"() {
    "use strict";
    init_storage();
    init_pythonNatal();
    init_openai();
    init_geocoding();
    dayjs2.extend(utc2);
    dayjs2.extend(timezone2);
  }
});

// server/index.ts
import express2 from "express";
import { createServer as createServer2 } from "http";

// server/routes.ts
init_storage();
import { createServer } from "http";

// server/lib/jwt.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// server/middleware/auth.ts
init_storage();
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
  const user = await storage.getUser(payload.userId);
  if (!user) {
    return res.status(401).json({ ok: false, error: "User not found" });
  }
  req.user = user;
  req.userId = user.id;
  next();
}
async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
  const user = await storage.getUser(payload.userId);
  if (!user) {
    return res.status(401).json({ ok: false, error: "User not found" });
  }
  if (!user.isAdmin) {
    return res.status(403).json({ ok: false, error: "Admin access required" });
  }
  req.user = user;
  req.userId = user.id;
  next();
}

// server/lib/telegram.ts
import crypto from "crypto";
function validateTelegramInitData(initData) {
  if (!initData) return false;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    params.delete("hash");
    if (!hash) return false;
    const dataCheckString = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return false;
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    return calculatedHash === hash;
  } catch (error) {
    console.error("Telegram validation error:", error);
    return false;
  }
}
function parseTelegramInitData(initData) {
  const params = new URLSearchParams(initData);
  const userParam = params.get("user");
  if (!userParam) return null;
  try {
    return JSON.parse(userParam);
  } catch {
    return null;
  }
}

// server/lib/referral.ts
import { nanoid } from "nanoid";
function generateReferralCode() {
  return nanoid(10);
}
async function applyReferralBonus(storage2, userId, referralCode) {
  if (!referralCode) return false;
  const referrer = await storage2.getUserByReferralCode(referralCode);
  if (!referrer || referrer.id === userId) {
    return false;
  }
  await storage2.updateUser(userId, { referredById: referrer.id });
  const currentPurchasedEnergy = referrer.purchasedEnergy || 0;
  await storage2.updateUser(referrer.id, { purchasedEnergy: currentPurchasedEnergy + 5 });
  await storage2.createReferralReward({
    referrerId: referrer.id,
    referredUserId: userId,
    rewardType: "signup",
    energyAmount: 5
  });
  return true;
}
async function handleSubscriptionReferralBonus(storage2, userId) {
  const user = await storage2.getUser(userId);
  if (user?.referredById) {
    const referrer = await storage2.getUser(user.referredById);
    if (referrer) {
      const currentPurchasedEnergy = referrer.purchasedEnergy || 0;
      await storage2.updateUser(referrer.id, { purchasedEnergy: currentPurchasedEnergy + 10 });
      await storage2.createReferralReward({
        referrerId: referrer.id,
        referredUserId: userId,
        rewardType: "subscription",
        energyAmount: 10
      });
    }
  }
}

// server/lib/energy.ts
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
dayjs.extend(utc);
dayjs.extend(timezone);
var ENERGY_COSTS = {
  solar: 11,
  horoscope: 2,
  compatibility: 2,
  ask: 1,
  natal_external: 2,
  important_date_detail: 1,
  compatibility_professional: 4,
  // Профессиональная синастрия
  weekly_plan: 1,
  // План на неделю
  monthly_plan: 1
  // План на месяц
};
var SUBSCRIPTION_DAILY_ENERGY = {
  standard: 100,
  pro: 250
};
function getNextResetTime(userTimezone) {
  const now = dayjs().tz(userTimezone);
  const tomorrow = now.add(1, "day").startOf("day");
  return tomorrow.toDate();
}
async function checkSubscriptionExpiry(storage2, userId) {
  const subscription = await storage2.getSubscription(userId);
  if (!subscription || !subscription.currentPeriodEnd) {
    return subscription;
  }
  const now = /* @__PURE__ */ new Date();
  const periodEnd = new Date(subscription.currentPeriodEnd);
  if (now > periodEnd && subscription.status !== "expired") {
    console.log("[SUBSCRIPTION] Marking as expired for user:", userId);
    await storage2.updateSubscription(subscription.id, { status: "expired" });
    return { ...subscription, status: "expired" };
  }
  return subscription;
}
async function checkAndResetEnergy(storage2, userId) {
  const user = await storage2.getUser(userId);
  if (!user) return;
  const now = /* @__PURE__ */ new Date();
  const resetAt = new Date(user.energyResetAt);
  if (now >= resetAt) {
    let subscription = await storage2.getSubscription(userId);
    if (subscription && subscription.currentPeriodEnd) {
      const periodEnd = new Date(subscription.currentPeriodEnd);
      if (now > periodEnd && subscription.status !== "expired") {
        console.log("[SUBSCRIPTION] Subscription expired for user:", userId);
        await storage2.updateSubscription(subscription.id, { status: "expired" });
        subscription = { ...subscription, status: "expired" };
      }
    }
    let newFreeEnergy = 10;
    if (subscription?.status === "active" || subscription?.status === "canceled") {
      newFreeEnergy = SUBSCRIPTION_DAILY_ENERGY[subscription.tier] || 10;
    }
    const nextReset = getNextResetTime(user.timezone);
    await storage2.updateUser(userId, {
      freeEnergy: newFreeEnergy,
      energyResetAt: nextReset
    });
  }
}
async function deductEnergy(storage2, userId, feature) {
  await checkAndResetEnergy(storage2, userId);
  const user = await storage2.getUser(userId);
  if (!user) {
    return { ok: false, error: "User not found" };
  }
  const cost = ENERGY_COSTS[feature];
  const totalEnergy = user.freeEnergy + user.purchasedEnergy;
  if (totalEnergy < cost) {
    return { ok: false, error: "Insufficient energy" };
  }
  let newFreeEnergy = user.freeEnergy;
  let newPurchasedEnergy = user.purchasedEnergy;
  if (user.freeEnergy >= cost) {
    newFreeEnergy = user.freeEnergy - cost;
  } else {
    const remainingCost = cost - user.freeEnergy;
    newFreeEnergy = 0;
    newPurchasedEnergy = user.purchasedEnergy - remainingCost;
  }
  await storage2.updateUser(userId, {
    freeEnergy: newFreeEnergy,
    purchasedEnergy: newPurchasedEnergy
  });
  await storage2.createUsageLog({ userId, feature, cost });
  return { ok: true };
}

// server/routes.ts
init_ton();
init_openai();
init_pythonNatal();
init_natalService();

// server/lib/transits.ts
import { spawn as spawn2 } from "child_process";
import path3 from "path";
async function findImportantEvents(natalPlanets, options) {
  return new Promise((resolve, reject) => {
    const scriptPath = path3.join(process.cwd(), "server", "transit_events_api.py");
    const inputData = {
      natal_planets: natalPlanets,
      from_date: options.from.toISOString().split("T")[0],
      // YYYY-MM-DD
      to_date: options.to.toISOString().split("T")[0],
      limit: options.limit || 10
    };
    const pythonProcess = spawn2("python3", [scriptPath]);
    let stdout = "";
    let stderr = "";
    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (result.ok) {
            resolve(result.events);
          } else {
            reject(new Error(`Transit calculation failed: ${result.error}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse Python output: ${err}`));
        }
      } else {
        try {
          const errorObj = JSON.parse(stderr);
          reject(new Error(`Python error: ${errorObj.error || stderr}`));
        } catch {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        }
      }
    });
    pythonProcess.on("error", (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
    pythonProcess.stdin.write(JSON.stringify(inputData));
    pythonProcess.stdin.end();
  });
}
function extractNatalPlanets(natalChartData) {
  const planets = [];
  const planetsData = natalChartData.planets;
  if (Array.isArray(planetsData)) {
    for (const planet of planetsData) {
      if (planet.name && planet.longitude !== void 0) {
        planets.push({
          name: planet.name,
          longitude: planet.longitude
        });
      }
    }
  } else if (typeof planetsData === "object") {
    for (const [name, data] of Object.entries(planetsData)) {
      if (data && typeof data === "object" && "longitude" in data) {
        planets.push({
          name,
          longitude: data.longitude
        });
      }
    }
  }
  return planets;
}

// server/routes.ts
init_geocoding();

// server/lib/tgLoginVerify.ts
init_storage();
import crypto2 from "crypto";
import { z as z2 } from "zod";
var TelegramLoginInput = z2.object({
  id: z2.union([z2.number(), z2.string()]).transform((val) => String(val)),
  first_name: z2.string().optional(),
  last_name: z2.string().optional(),
  username: z2.string().optional(),
  photo_url: z2.string().optional(),
  auth_date: z2.union([z2.number(), z2.string()]).transform((val) => String(val)),
  hash: z2.string()
});
var BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
var ALLOWED_SKEW_SECONDS = Number(process.env.LOGIN_ALLOWED_SKEW_SECONDS || "86400");
function verifyTelegramLoginHash(data) {
  const secretKey = crypto2.createHash("sha256").update(BOT_TOKEN).digest();
  const dataCheckString = Object.keys(data).filter((key) => key !== "hash").sort().map((key) => `${key}=${data[key]}`).join("\n");
  const hmac = crypto2.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return hmac === data.hash;
}
async function handleTelegramLoginWidget(req, res) {
  try {
    console.log("[Telegram Login Widget] Received data:", JSON.stringify(req.body, null, 2));
    const parsed = TelegramLoginInput.safeParse(req.body);
    if (!parsed.success) {
      console.error("[Telegram Login Widget] Validation failed:", parsed.error.format());
      return res.status(400).json({
        ok: false,
        error: "Invalid input data",
        details: parsed.error.format()
      });
    }
    const loginData = parsed.data;
    console.log("[Telegram Login Widget] Validation passed, user ID:", loginData.id);
    const nowSeconds = Math.floor(Date.now() / 1e3);
    const authSeconds = Number(loginData.auth_date);
    if (!Number.isFinite(authSeconds) || Math.abs(nowSeconds - authSeconds) > ALLOWED_SKEW_SECONDS) {
      console.error("[Telegram Login Widget] Auth expired. Now:", nowSeconds, "Auth:", authSeconds);
      return res.status(401).json({
        ok: false,
        error: "Authentication expired"
      });
    }
    const dataAsStrings = Object.fromEntries(
      Object.entries(loginData).map(([k, v]) => [k, String(v)])
    );
    if (!verifyTelegramLoginHash(dataAsStrings)) {
      console.error("[Telegram Login Widget] Invalid signature");
      return res.status(401).json({
        ok: false,
        error: "Invalid signature"
      });
    }
    console.log("[Telegram Login Widget] Signature verified successfully");
    const tgId = String(loginData.id);
    let user = await storage.getUserByTgId(tgId);
    if (!user) {
      const name = [loginData.first_name, loginData.last_name].filter(Boolean).join(" ") || loginData.username || "User";
      const referralCode = generateReferralCode();
      user = await storage.createUser({
        tgId,
        username: loginData.username || null,
        name,
        gender: "other",
        // Will be set during Mini App registration
        age: 18,
        // Placeholder, will be updated
        birthdayDate: /* @__PURE__ */ new Date(0),
        // Placeholder
        birthTime: null,
        birthPlace: null,
        timezone: "Europe/Moscow",
        referralCode
      });
      await storage.updateUser(user.id, {
        freeEnergy: 10,
        purchasedEnergy: 0,
        energyResetAt: getNextResetTime("Europe/Moscow")
      });
      user = await storage.getUser(user.id) || user;
    } else {
      if (loginData.username && user.username !== loginData.username) {
        await storage.updateUser(user.id, {
          username: loginData.username
        });
        user = await storage.getUser(user.id) || user;
      }
    }
    const token = generateToken(user.id);
    res.json({
      ok: true,
      data: {
        user,
        token
      }
    });
  } catch (error) {
    console.error("Telegram Login Widget error:", error);
    res.status(500).json({
      ok: false,
      error: error.message || "Internal server error"
    });
  }
}

// server/lib/yookassa.ts
var getYooKassaClient = async () => {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  console.log("[YooKassa] Initializing client with credentials:", {
    shopId: shopId ? `${shopId.substring(0, 4)}...` : "MISSING",
    secretKeyPresent: !!secretKey
  });
  if (!shopId || !secretKey) {
    throw new Error("YooKassa credentials not configured. Please set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY");
  }
  try {
    const yookassaModule = await import("@appigram/yookassa-node");
    console.log("[YooKassa] Module loaded, keys:", Object.keys(yookassaModule));
    console.log("[YooKassa] Default export type:", typeof yookassaModule.default);
    console.log("[YooKassa] YooKassa export type:", typeof yookassaModule.YooKassa);
    const factory = yookassaModule.default || yookassaModule;
    let client;
    try {
      client = factory(shopId, secretKey);
      console.log("[YooKassa] Client created via factory function");
    } catch (factoryError) {
      console.log("[YooKassa] Factory function failed, trying constructor:", factoryError.message);
      client = new factory(shopId, secretKey);
      console.log("[YooKassa] Client created via constructor");
    }
    console.log("[YooKassa] Client type:", typeof client);
    console.log("[YooKassa] Client methods:", Object.keys(client));
    return client;
  } catch (error) {
    console.error("[YooKassa] Failed to initialize client:", error);
    throw new Error(`Failed to initialize YooKassa client: ${error.message}`);
  }
};
async function createPayment(params) {
  const isTestMode = process.env.YOOKASSA_TEST_MODE === "true";
  console.log("[YooKassa] Creating payment:", {
    amount: params.amount,
    description: params.description,
    testMode: isTestMode
  });
  const yooKassa = await getYooKassaClient();
  console.log("[YooKassa] Client obtained, calling createPayment API");
  try {
    const receiptCustomer = params.customerEmail ? { email: params.customerEmail } : params.customerPhone ? { phone: params.customerPhone } : { email: "no-email@astro-orb.app" };
    const paymentData = {
      amount: {
        value: params.amount,
        currency: "RUB"
      },
      confirmation: {
        type: "redirect",
        return_url: params.returnUrl
      },
      description: params.description,
      capture: true,
      // Auto-capture payment after authorization
      metadata: params.metadata || {},
      test: isTestMode,
      receipt: {
        customer: receiptCustomer,
        items: [
          {
            description: params.description,
            quantity: "1",
            amount: {
              value: params.amount,
              currency: "RUB"
            },
            vat_code: 1
            // НДС не облагается (для самозанятых)
          }
        ]
      }
    };
    console.log("[YooKassa] Payment data with receipt:", JSON.stringify(paymentData, null, 2));
    const payment = await yooKassa.createPayment(paymentData);
    console.log("[YooKassa] Payment created:", {
      id: payment.id,
      status: payment.status,
      confirmationUrl: payment.confirmation?.confirmation_url
    });
    return payment;
  } catch (error) {
    console.error("[YooKassa] Error creating payment:", error);
    throw new Error(`Failed to create YooKassa payment: ${error.message}`);
  }
}
function verifyWebhookIP(ipAddress) {
  if (process.env.YOOKASSA_TEST_MODE === "true") {
    console.log("[YooKassa] Test mode - allowing all webhook IPs");
    return true;
  }
  const allowedIPs = [
    "77.75.156.11",
    "77.75.156.35"
  ];
  const isAllowed = allowedIPs.includes(ipAddress);
  if (!isAllowed) {
    console.warn("[YooKassa] Webhook from unauthorized IP:", ipAddress);
    console.warn('[YooKassa] To allow CIDR ranges in production, install a CIDR library like "ipaddr.js"');
  }
  return isAllowed;
}
function parseWebhookPayload(body) {
  try {
    if (!body || !body.object || body.event !== "payment.succeeded") {
      console.warn("[YooKassa] Invalid webhook payload structure");
      return null;
    }
    return body.object;
  } catch (error) {
    console.error("[YooKassa] Error parsing webhook payload:", error);
    return null;
  }
}

// server/routes.ts
import { z as z3 } from "zod";
import dayjs3 from "dayjs";
import utc3 from "dayjs/plugin/utc.js";
import timezone3 from "dayjs/plugin/timezone.js";
dayjs3.extend(utc3);
dayjs3.extend(timezone3);
async function registerRoutes(app2) {
  app2.post("/api/auth/telegram", async (req, res) => {
    try {
      const { initData, name, gender, age, birthdayDate, birthTime, birthPlace, timezone: timezone4 } = req.body;
      const allowTestAuth = process.env.ALLOW_TEST_AUTH === "true";
      const hasInitData = initData && initData.length > 0;
      if (!hasInitData && !allowTestAuth) {
        return res.status(401).json({ ok: false, error: "Invalid Telegram data: initData required" });
      }
      if (hasInitData && !validateTelegramInitData(initData)) {
        return res.status(401).json({ ok: false, error: "Invalid Telegram data: validation failed" });
      }
      let tgUser = hasInitData ? parseTelegramInitData(initData) : null;
      if (!tgUser && allowTestAuth) {
        const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        tgUser = {
          id: parseInt(testId.replace(/\D/g, "").slice(0, 9)) || 999999999,
          first_name: name || "Test User",
          username: `testuser_${Date.now()}`
        };
        console.log("[Auth] Test mode: Created fake Telegram user", tgUser);
      }
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
          birthdayDate: new Date(birthdayDate || /* @__PURE__ */ new Date()),
          birthTime: birthTime || null,
          birthPlace: birthPlace || null,
          timezone: timezone4 || "Europe/Moscow",
          referralCode
        });
        await storage.updateUser(user.id, {
          freeEnergy: 10,
          energyResetAt: getNextResetTime(timezone4 || "Europe/Moscow")
        });
        if (req.body.referralCode) {
          await applyReferralBonus(storage, user.id, req.body.referralCode);
        }
        user = await storage.getUser(user.id) || user;
      }
      const token = generateToken(user.id);
      res.json({ ok: true, data: { user, token } });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/auth/tg-login", handleTelegramLoginWidget);
  app2.post("/api/auth/test", async (req, res) => {
    const isTestAuthAllowed = process.env.NODE_ENV === "development" || process.env.ALLOW_TEST_AUTH === "true";
    if (!isTestAuthAllowed) {
      console.log("=== /api/auth/test BLOCKED ===");
      console.log("ALLOW_TEST_AUTH:", process.env.ALLOW_TEST_AUTH);
      console.log("NODE_ENV:", process.env.NODE_ENV);
      return res.status(403).json({
        ok: false,
        error: "Test authentication is disabled. Please use Telegram Mini App or Login Widget."
      });
    }
    console.log("=== /api/auth/test endpoint hit (test auth enabled) ===");
    console.log("Request body:", req.body);
    try {
      const { name, gender, age, birthdayDate, birthTime, birthPlace, timezone: timezone4, referralCode: inputReferralCode } = req.body;
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
          birthdayDate: new Date(birthdayDate || /* @__PURE__ */ new Date()),
          birthTime: birthTime || null,
          birthPlace: birthPlace || null,
          timezone: timezone4 || "America/New_York",
          referralCode,
          freeEnergy: 10,
          energyResetAt: getNextResetTime(timezone4 || "America/New_York")
        };
        user = await storage.createUser(newUser);
        if (inputReferralCode) {
          await applyReferralBonus(storage, user.id, inputReferralCode);
        }
      }
      const token = generateToken(user.id);
      res.json({ ok: true, data: { user, token } });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/dev/test-referral", requireAuth, async (req, res) => {
    const isTestAuthAllowed = process.env.NODE_ENV === "development" || process.env.ALLOW_TEST_AUTH === "true";
    if (!isTestAuthAllowed) {
      return res.status(403).json({
        ok: false,
        error: "Test referral endpoint is only available in development mode"
      });
    }
    try {
      const userId = req.userId;
      const { action } = req.body;
      if (!action || !["simulate_signup", "simulate_subscription"].includes(action)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid action. Use "simulate_signup" or "simulate_subscription"'
        });
      }
      const referrer = await storage.getUser(userId);
      if (!referrer) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      if (action === "simulate_signup") {
        const testUser = {
          tgId: `virtual_test_${Date.now()}`,
          username: `test_referred_${Date.now()}`,
          name: `Test User ${Date.now()}`,
          gender: "other",
          age: 25,
          birthdayDate: /* @__PURE__ */ new Date(),
          birthTime: null,
          birthPlace: null,
          timezone: "America/New_York",
          referralCode: generateReferralCode(),
          freeEnergy: 10,
          energyResetAt: getNextResetTime("America/New_York")
        };
        const newUser = await storage.createUser(testUser);
        await applyReferralBonus(storage, newUser.id, referrer.referralCode);
        const updatedReferrer = await storage.getUser(userId);
        return res.json({
          ok: true,
          data: {
            action: "simulate_signup",
            testUser: {
              id: newUser.id,
              name: newUser.name,
              username: newUser.username
            },
            referrer: {
              id: updatedReferrer?.id,
              name: updatedReferrer?.name,
              purchasedEnergy: updatedReferrer?.purchasedEnergy
            },
            rewardAmount: 5,
            message: "Simulated new user signup via your referral code. You received +5 energy!"
          }
        });
      }
      if (action === "simulate_subscription") {
        const rewards = await storage.getReferralRewardsByReferrerId(userId);
        if (rewards.length === 0) {
          return res.status(400).json({
            ok: false,
            error: 'No referred users found. Simulate a signup first using action: "simulate_signup"'
          });
        }
        const latestReward = rewards.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        const referredUser = await storage.getUser(latestReward.referredUserId);
        if (!referredUser) {
          return res.status(404).json({ ok: false, error: "Referred user not found" });
        }
        await handleSubscriptionReferralBonus(storage, referredUser.id);
        const updatedReferrer = await storage.getUser(userId);
        return res.json({
          ok: true,
          data: {
            action: "simulate_subscription",
            referredUser: {
              id: referredUser.id,
              name: referredUser.name
            },
            referrer: {
              id: updatedReferrer?.id,
              name: updatedReferrer?.name,
              purchasedEnergy: updatedReferrer?.purchasedEnergy
            },
            rewardAmount: 10,
            message: "Simulated subscription purchase by your referred user. You received +10 energy!"
          }
        });
      }
      res.status(400).json({ ok: false, error: "Invalid action" });
    } catch (error) {
      console.error("[DEV] Test referral error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/user/me", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      const subscription = await checkSubscriptionExpiry(storage, userId);
      const natalChart = await storage.getNatalChart(userId);
      res.json({ ok: true, data: {
        ...user,
        energy: (user.freeEnergy || 0) + (user.purchasedEnergy || 0),
        subscription,
        natalInitialized: !!natalChart
      } });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/user/update", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const { name, gender, age, birthdayDate, birthTime, birthPlace, timezone: timezone4 } = req.body;
      const currentUser = await storage.getUser(userId);
      if (currentUser?.lastProfileUpdate) {
        const lastUpdate = new Date(currentUser.lastProfileUpdate);
        const now = /* @__PURE__ */ new Date();
        const daysSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1e3 * 60 * 60 * 24));
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
        timezone: timezone4,
        lastProfileUpdate: /* @__PURE__ */ new Date()
      });
      res.json({ ok: true, data: user });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/user/subscription/cancel", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const subscription = await storage.getSubscription(userId);
      if (!subscription) {
        return res.status(404).json({ ok: false, error: "No active subscription found" });
      }
      if (subscription.status !== "active") {
        return res.status(400).json({ ok: false, error: "Subscription is not active" });
      }
      await storage.updateSubscription(subscription.id, { status: "canceled" });
      res.json({
        ok: true,
        data: {
          message: "Subscription canceled successfully. Benefits remain until period end.",
          currentPeriodEnd: subscription.currentPeriodEnd
        }
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/dev/subscribe", requireAuth, async (req, res) => {
    if (process.env.NODE_ENV !== "development") {
      return res.status(403).json({ ok: false, error: "Only available in development mode" });
    }
    try {
      const userId = req.userId;
      const { tier } = req.body;
      if (!tier || tier !== "standard" && tier !== "pro") {
        return res.status(400).json({ ok: false, error: "Invalid tier. Use 'standard' or 'pro'" });
      }
      const startedAt = /* @__PURE__ */ new Date();
      const currentPeriodEnd = dayjs3(startedAt).add(30, "days").toDate();
      const existingSub = await storage.getSubscription(userId);
      if (existingSub) {
        await storage.updateSubscription(existingSub.id, {
          tier,
          status: "active",
          currentPeriodEnd
        });
      } else {
        await storage.createSubscription({
          userId,
          tier,
          status: "active",
          startedAt,
          currentPeriodEnd
        });
      }
      const subscriptionEnergy = tier === "standard" ? 100 : 250;
      const user = await storage.getUser(userId);
      if (user) {
        await storage.updateUser(userId, {
          purchasedEnergy: (user.purchasedEnergy || 0) + subscriptionEnergy
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
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/natal/init", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const locale = req.body.locale || "ru";
      const chart = await ensureUserNatalChart(userId, locale);
      res.json({ ok: true, data: chart });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/natal/me", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const locale = req.query.locale || "ru";
      await recomputeIfProfileChanged(userId, locale);
      const chart = await storage.getNatalChart(userId);
      if (!chart) {
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }
      res.json({ ok: true, data: chart });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/natal/recalculate", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const locale = req.body.locale || "ru";
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      const newData = await computeNatalFromUser(user, locale);
      await storage.updateNatalChart(userId, { data: newData });
      const updatedChart = await storage.getNatalChart(userId);
      res.json({ ok: true, data: updatedChart });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/natal/external", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const externalNatalSchema = z3.object({
        name: z3.string().min(1),
        gender: z3.enum(["male", "female", "other"]),
        birthdayDate: z3.string(),
        birthTime: z3.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
        birthPlace: z3.string().optional().nullable(),
        timezone: z3.string().default("Europe/Moscow"),
        locale: z3.string().default("ru")
      });
      const data = externalNatalSchema.parse(req.body);
      const deductResult = await deductEnergy(storage, userId, "natal_external");
      if (!deductResult.ok) {
        return res.status(400).json({ ok: false, error: deductResult.error });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      const birthdayStr = data.birthdayDate;
      const [datePart] = birthdayStr.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const birthTimeStr = data.birthTime || "12:00";
      const [localHours, localMinutes] = birthTimeStr.split(":").map(Number);
      const coords = await geocodeCityWithFallback(data.birthPlace || null);
      const userTimezone = data.timezone || "UTC";
      const localDateTimeStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(localHours).padStart(2, "0")}:${String(localMinutes).padStart(2, "0")}:00`;
      const localDateTime = dayjs3.tz(localDateTimeStr, userTimezone);
      const utcDateTime = localDateTime.utc();
      const pythonChart = await calculateNatalChartPython({
        year: utcDateTime.year(),
        month: utcDateTime.month() + 1,
        day: utcDateTime.date(),
        hour: utcDateTime.hour(),
        minute: utcDateTime.minute(),
        latitude: coords.lat,
        longitude: coords.lon
      });
      const interpretation = await getAstrologyInterpretation(
        "natal",
        pythonChart,
        data.locale,
        data.gender
      );
      const natalData = {
        ...pythonChart,
        interpretation
      };
      const externalNatal = await storage.createExternalNatal({
        ownerId: userId,
        name: data.name,
        gender: data.gender,
        birthdayDate: new Date(data.birthdayDate),
        birthTime: data.birthTime || null,
        birthPlace: data.birthPlace || null,
        timezone: data.timezone,
        data: natalData
      });
      res.json({ ok: true, data: externalNatal });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/natal/external", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const charts = await storage.getExternalNatalsByOwnerId(userId);
      res.json({ ok: true, data: charts });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/natal/external/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const chartId = req.params.id;
      const chart = await storage.getExternalNatal(chartId);
      if (!chart) {
        return res.status(404).json({ ok: false, error: "Chart not found" });
      }
      if (chart.ownerId !== userId) {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }
      res.json({ ok: true, data: chart });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.delete("/api/natal/external/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const chartId = req.params.id;
      const chart = await storage.getExternalNatal(chartId);
      if (!chart) {
        return res.status(404).json({ ok: false, error: "Chart not found" });
      }
      if (chart.ownerId !== userId) {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }
      await storage.deleteExternalNatal(chartId);
      res.json({ ok: true, message: "Chart deleted successfully" });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/energy", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      res.json({
        ok: true,
        data: {
          energy: user ? user.freeEnergy + user.purchasedEnergy : 0,
          resetAt: user?.energyResetAt || /* @__PURE__ */ new Date()
        }
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/astrology/natal", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const locale = req.body.locale || "en";
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      const natalChart = await ensureUserNatalChart(userId);
      const savedChart = natalChart.data;
      const interpretation = await getAstrologyInterpretation("natal", savedChart, locale, user.gender);
      const planetsArray = Object.entries(savedChart.planets).map(([name, data]) => ({
        name,
        sign: data.sign,
        position: data.longitude,
        longitude: data.longitude,
        latitude: data.latitude,
        degree_in_sign: data.degree_in_sign
      }));
      res.json({
        ok: true,
        data: {
          planets: planetsArray,
          houses: savedChart.houses,
          angles: savedChart.angles,
          aspects: [],
          interpretation
        }
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/astrology/natal/old", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const locale = req.body.locale || "en";
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
      const [hours, minutes] = user.birthTime.split(":").map(Number);
      const coords = await geocodeCityWithFallback(user.birthPlace);
      const pythonChart = await calculateNatalChartPython({
        year: birthDate.getFullYear(),
        month: birthDate.getMonth() + 1,
        day: birthDate.getDate(),
        hour: hours,
        minute: minutes,
        latitude: coords.lat,
        longitude: coords.lon,
        house_system: "Placidus"
      });
      const planetsArray = Object.entries(pythonChart.planets).map(([name, data]) => ({
        name,
        sign: data.sign,
        position: data.longitude,
        // Python возвращает longitude, фронтенд ожидает position
        longitude: data.longitude,
        latitude: data.latitude,
        degree_in_sign: data.degree_in_sign
      }));
      const interpretation = await getAstrologyInterpretation("natal", pythonChart, locale, user.gender);
      const chartToSave = {
        ...pythonChart,
        interpretation
        // Добавляем интерпретацию в сохранённые данные
      };
      await storage.updateUser(userId, {
        natalChart: chartToSave
      });
      await storage.createNatalReading({
        userId,
        planets: pythonChart.planets,
        aspects: [],
        // Python версия пока не рассчитывает аспекты
        interpretation
      });
      res.json({
        ok: true,
        data: {
          planets: planetsArray,
          houses: pythonChart.houses,
          angles: pythonChart.angles,
          aspects: [],
          // Python версия пока не рассчитывает аспекты
          interpretation
        }
      });
    } catch (error) {
      console.error("Natal chart calculation error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/astrology/planet-interpretation", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const { planet, locale = "ru", chartType = "own", chartId } = req.body;
      const validPlanets = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "North Node", "South Node"];
      if (!planet || !validPlanets.includes(planet)) {
        return res.status(400).json({
          ok: false,
          error: "Invalid planet. Must be one of: " + validPlanets.join(", ")
        });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      let savedChart;
      let chartOwner = user;
      if (chartType === "guest" && chartId) {
        const guestChart = await storage.getExternalNatal(chartId);
        if (!guestChart) {
          return res.status(404).json({ ok: false, error: "Guest chart not found" });
        }
        if (guestChart.ownerId !== userId) {
          return res.status(403).json({ ok: false, error: "Access denied" });
        }
        if (!guestChart.data || typeof guestChart.data !== "object" || !("planets" in guestChart.data)) {
          return res.status(400).json({
            ok: false,
            error: "Guest chart data is invalid"
          });
        }
        savedChart = guestChart.data;
        chartOwner = {
          ...user,
          name: guestChart.name,
          gender: guestChart.gender,
          birthdayDate: guestChart.birthdayDate
        };
      } else {
        const ownChart = await storage.getNatalChart(userId);
        if (!ownChart || !ownChart.data || typeof ownChart.data !== "object" || !("planets" in ownChart.data)) {
          return res.status(400).json({
            ok: false,
            error: "Natal chart not found. Please generate your natal chart first."
          });
        }
        savedChart = ownChart.data;
      }
      const planetData = savedChart.planets[planet];
      if (!planetData) {
        return res.status(404).json({
          ok: false,
          error: locale === "ru" ? `${planet} \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u0432\u0430\u0448\u0435\u0439 \u043D\u0430\u0442\u0430\u043B\u044C\u043D\u043E\u0439 \u043A\u0430\u0440\u0442\u0435. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u0435\u0440\u0435\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043A\u0430\u0440\u0442\u0443.` : `${planet} not found in your natal chart. Try regenerating your chart.`
        });
      }
      const findHouse = (longitude) => {
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
      const chartAspects = savedChart.aspects || [];
      const planetAspects = chartAspects.filter(
        (aspect) => aspect.planet1 === planet || aspect.planet2 === planet
      ).map((aspect) => ({
        to: aspect.planet1 === planet ? aspect.planet2 : aspect.planet1,
        type: aspect.type,
        orb_deg: aspect.orb
      }));
      const interpretationData = {
        planet: {
          name: planet,
          sign: planetData.sign,
          house,
          aspects: planetAspects
        },
        profile: {
          name: chartOwner.name,
          age: chartOwner.birthdayDate ? (/* @__PURE__ */ new Date()).getFullYear() - new Date(chartOwner.birthdayDate).getFullYear() : void 0,
          gender: chartOwner.gender || void 0
        }
      };
      const interpretation = await getPlanetInterpretation(interpretationData, locale);
      res.json({
        ok: true,
        data: interpretation
      });
    } catch (error) {
      console.error("Planet interpretation error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/astrology/solar", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const locale = req.body.locale || "en";
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      const cost = ENERGY_COSTS.solar;
      if (user.freeEnergy + user.purchasedEnergy < cost) {
        return res.status(400).json({ ok: false, error: "Insufficient energy" });
      }
      const today = /* @__PURE__ */ new Date();
      const solarYear = today.getFullYear();
      const birthDate = new Date(user.birthdayDate);
      const solarDate = new Date(solarYear, birthDate.getMonth(), birthDate.getDate());
      const [hours = 12, minutes = 0] = (user.birthTime || "12:00").split(":").map(Number);
      const coords = await geocodeCityWithFallback(user.birthPlace);
      const solarChartData = await calculateNatalChartPython({
        year: solarDate.getFullYear(),
        month: solarDate.getMonth() + 1,
        day: solarDate.getDate(),
        hour: hours,
        minute: minutes,
        latitude: coords.lat,
        longitude: coords.lon,
        house_system: "Placidus"
      });
      const sunData = solarChartData.planets["Sun"];
      const solar = {
        position: sunData.longitude,
        sign: sunData.sign,
        date: solarDate
      };
      const interpretation = await getAstrologyInterpretation("solar", solar, locale, user.gender);
      const insights = locale === "ru" ? [
        "\u0421\u0435\u0433\u043E\u0434\u043D\u044F\u0448\u043D\u044F\u044F \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u044D\u043D\u0435\u0440\u0433\u0438\u044F \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u043D\u043E\u0432\u044B\u0435 \u043D\u0430\u0447\u0438\u043D\u0430\u043D\u0438\u044F",
        "\u0421\u043E\u0441\u0440\u0435\u0434\u043E\u0442\u043E\u0447\u044C\u0442\u0435\u0441\u044C \u043D\u0430 \u043B\u0438\u0447\u043D\u043E\u0441\u0442\u043D\u043E\u043C \u0440\u043E\u0441\u0442\u0435 \u0438 \u0441\u0430\u043C\u043E\u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u0438",
        "\u0414\u043E\u0432\u0435\u0440\u044F\u0439\u0442\u0435 \u0441\u0432\u043E\u0435\u0439 \u0438\u043D\u0442\u0443\u0438\u0446\u0438\u0438 \u0432 \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u0438 \u0440\u0435\u0448\u0435\u043D\u0438\u0439"
      ] : [
        "Today's cosmic energy supports new beginnings",
        "Focus on personal growth and self-expression",
        "Trust your intuition in decision-making"
      ];
      await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
      await storage.createUsageLog({ userId, feature: "solar", cost });
      res.json({
        ok: true,
        data: {
          solar,
          interpretation,
          insights
        }
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/astrology/horoscope", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const locale = req.body.locale || "ru";
      console.log("[HOROSCOPE] Request started - userId:", userId, "locale:", locale);
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      const natalChart = await storage.getNatalChart(userId);
      console.log("[HOROSCOPE] Natal chart exists:", !!natalChart);
      if (!natalChart || !natalChart.data) {
        console.log("[HOROSCOPE] ERROR: NATAL_NOT_INITIALIZED");
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }
      const cost = ENERGY_COSTS.horoscope;
      if (user.freeEnergy + user.purchasedEnergy < cost) {
        return res.status(402).json({ ok: false, error: "Insufficient energy" });
      }
      console.log("[HOROSCOPE] Calling interpretHoroscope...");
      const result = await interpretHoroscope({
        profile: {
          name: user.name,
          gender: user.gender,
          timezone: user.timezone
        },
        natal: natalChart.data,
        transits: []
      }, locale);
      console.log("[HOROSCOPE] interpretHoroscope returned successfully");
      const now = dayjs3().tz(user.timezone);
      const today = now.format("YYYY-MM-DD");
      await storage.createHoroscopeReading({
        userId,
        period: "day",
        startDate: today,
        endDate: today,
        forecast: JSON.stringify(result)
      });
      console.log("[HOROSCOPE] Saved to database");
      await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
      await storage.createUsageLog({ userId, feature: "horoscope", cost });
      console.log("[HOROSCOPE] Request completed successfully");
      res.json({
        ok: true,
        data: result
      });
    } catch (error) {
      console.error("[HOROSCOPE] Error occurred:", error.message);
      console.error("[HOROSCOPE] Error stack:", error.stack);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/astrology/horoscope/weekly-plan", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const { week_start_iso } = req.body;
      const locale = req.body.locale || "ru";
      console.log("[WEEKLY_PLAN] User ID:", userId);
      console.log("[WEEKLY_PLAN] Request body:", { week_start_iso, locale });
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        console.log("[WEEKLY_PLAN] User not found");
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      console.log("[WEEKLY_PLAN] User energy:", user.freeEnergy + user.purchasedEnergy);
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart || !natalChart.data) {
        console.log("[WEEKLY_PLAN] Natal chart not initialized");
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }
      console.log("[WEEKLY_PLAN] Natal chart exists");
      const subscription = await checkSubscriptionExpiry(storage, userId);
      const hasActiveSubscription = subscription?.status === "active" || subscription?.status === "canceled";
      console.log("[WEEKLY_PLAN] Has active subscription:", hasActiveSubscription);
      if (!hasActiveSubscription) {
        const cost = ENERGY_COSTS.weekly_plan;
        if (user.freeEnergy + user.purchasedEnergy < cost) {
          console.log("[WEEKLY_PLAN] Insufficient energy:", user.freeEnergy + user.purchasedEnergy, "< cost:", cost);
          return res.status(402).json({ ok: false, error: "Insufficient energy" });
        }
      }
      let weekStart = week_start_iso;
      if (!weekStart) {
        const now = dayjs3().tz(user.timezone);
        const dayOfWeek = now.day();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = now.subtract(daysFromMonday, "day");
        weekStart = monday.format("YYYY-MM-DD");
      }
      const weekEnd = dayjs3(weekStart).add(6, "day").format("YYYY-MM-DD");
      console.log("[WEEKLY_PLAN] Week range:", weekStart, "to", weekEnd);
      console.log("[WEEKLY_PLAN] Calling generateWeeklyPlan...");
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
      console.log("[WEEKLY_PLAN] Result received:", JSON.stringify(result).substring(0, 200));
      await storage.createHoroscopeReading({
        userId,
        period: "week",
        startDate: weekStart,
        endDate: weekEnd,
        forecast: JSON.stringify(result),
        data: result
      });
      if (!hasActiveSubscription) {
        const cost = ENERGY_COSTS.weekly_plan;
        await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
        await storage.createUsageLog({ userId, feature: "weekly_plan", cost });
        console.log("[WEEKLY_PLAN] Energy deducted:", cost);
      }
      res.json({
        ok: true,
        data: result
      });
    } catch (error) {
      console.error("[WEEKLY_PLAN] Error:", error);
      console.error("[WEEKLY_PLAN] Error stack:", error.stack);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/astrology/horoscope/monthly-plan", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const { month_iso } = req.body;
      const locale = req.body.locale || "ru";
      console.log("[MONTHLY_PLAN] User ID:", userId);
      console.log("[MONTHLY_PLAN] Request body:", { month_iso, locale });
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        console.log("[MONTHLY_PLAN] User not found");
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      console.log("[MONTHLY_PLAN] User energy:", user.freeEnergy + user.purchasedEnergy);
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart || !natalChart.data) {
        console.log("[MONTHLY_PLAN] Natal chart not initialized");
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }
      console.log("[MONTHLY_PLAN] Natal chart exists");
      const subscription = await checkSubscriptionExpiry(storage, userId);
      const hasActiveSubscription = subscription?.status === "active" || subscription?.status === "canceled";
      console.log("[MONTHLY_PLAN] Has active subscription:", hasActiveSubscription);
      if (!hasActiveSubscription) {
        const cost = ENERGY_COSTS.monthly_plan;
        if (user.freeEnergy + user.purchasedEnergy < cost) {
          console.log("[MONTHLY_PLAN] Insufficient energy:", user.freeEnergy + user.purchasedEnergy, "< cost:", cost);
          return res.status(402).json({ ok: false, error: "Insufficient energy" });
        }
      }
      let monthStart = month_iso;
      if (!monthStart) {
        const now = dayjs3().tz(user.timezone);
        monthStart = now.startOf("month").format("YYYY-MM-DD");
      }
      const monthEnd = dayjs3(monthStart).endOf("month").format("YYYY-MM-DD");
      console.log("[MONTHLY_PLAN] Month range:", monthStart, "to", monthEnd);
      console.log("[MONTHLY_PLAN] Calling generateMonthlyPlan...");
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
      console.log("[MONTHLY_PLAN] Result received:", JSON.stringify(result).substring(0, 200));
      await storage.createHoroscopeReading({
        userId,
        period: "month",
        startDate: monthStart,
        endDate: monthEnd,
        forecast: JSON.stringify(result),
        data: result
      });
      if (!hasActiveSubscription) {
        const cost = ENERGY_COSTS.monthly_plan;
        await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
        await storage.createUsageLog({ userId, feature: "monthly_plan", cost });
        console.log("[MONTHLY_PLAN] Energy deducted:", cost);
      }
      res.json({
        ok: true,
        data: result
      });
    } catch (error) {
      console.error("[MONTHLY_PLAN] Error:", error);
      console.error("[MONTHLY_PLAN] Error stack:", error.stack);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/astrology/horoscope/archive", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const readings = await storage.getHoroscopeReadingsByUserId(userId, 100);
      const archive = readings.filter((r) => r.period === "week" || r.period === "month").map((r) => ({
        id: r.id,
        period: r.period,
        startDate: r.startDate,
        endDate: r.endDate,
        data: r.data,
        createdAt: r.createdAt
      }));
      res.json({
        ok: true,
        data: archive
      });
    } catch (error) {
      console.error("[ARCHIVE] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.delete("/api/astrology/horoscope/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const reading = await storage.getHoroscopeReadingsByUserId(userId, 100);
      const userReading = reading.find((r) => r.id === id);
      if (!userReading) {
        return res.status(404).json({ ok: false, error: "Reading not found" });
      }
      await storage.deleteHoroscopeReading(id);
      res.json({
        ok: true,
        message: "Reading deleted successfully"
      });
    } catch (error) {
      console.error("[DELETE_READING] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/astrology/compatibility", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const { partner, professional = false, relationshipType = "romantic", guestChartId } = req.body;
      const locale = req.body.locale || "en";
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      let finalGuestChartId = guestChartId;
      let needsNewGuestChart = false;
      if (!guestChartId) {
        const existingGuestCharts = await storage.getExternalNatalsByOwnerId(userId);
        const matchingChart = existingGuestCharts.find((chart) => {
          const chartDate = typeof chart.birthdayDate === "string" ? chart.birthdayDate.split("T")[0] : chart.birthdayDate.toISOString().split("T")[0];
          const partnerDate = partner.date.split("T")[0];
          return chartDate === partnerDate && chart.birthTime === (partner.time || null) && chart.name === partner.name;
        });
        if (matchingChart) {
          finalGuestChartId = matchingChart.id;
        } else {
          needsNewGuestChart = true;
        }
      }
      const baseCost = professional ? ENERGY_COSTS.compatibility_professional : ENERGY_COSTS.compatibility;
      const cost = needsNewGuestChart ? baseCost + 2 : baseCost;
      if (user.freeEnergy + user.purchasedEnergy < cost) {
        return res.status(400).json({ ok: false, error: "Insufficient energy" });
      }
      let person1ChartData;
      const natalChart = await storage.getNatalChart(userId);
      if (natalChart && natalChart.data) {
        person1ChartData = natalChart.data;
      } else {
        const birthdayStr = typeof user.birthdayDate === "string" ? user.birthdayDate : user.birthdayDate.toISOString();
        const [datePart] = birthdayStr.split("T");
        const [year, month, day] = datePart.split("-").map(Number);
        const [localHours = 12, localMinutes = 0] = (user.birthTime || "12:00").split(":").map(Number);
        const coords = await geocodeCityWithFallback(user.birthPlace);
        const userTimezone = user.timezone || "UTC";
        const localDateTimeStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(localHours).padStart(2, "0")}:${String(localMinutes).padStart(2, "0")}:00`;
        const localDateTime = dayjs3.tz(localDateTimeStr, userTimezone);
        const utcDateTime = localDateTime.utc();
        person1ChartData = await calculateNatalChartPython({
          year: utcDateTime.year(),
          month: utcDateTime.month() + 1,
          day: utcDateTime.date(),
          hour: utcDateTime.hour(),
          minute: utcDateTime.minute(),
          latitude: coords.lat,
          longitude: coords.lon,
          house_system: "Placidus"
        });
      }
      let person2ChartData;
      if (finalGuestChartId && !needsNewGuestChart) {
        const existingChart = await storage.getExternalNatal(finalGuestChartId);
        if (!existingChart || !existingChart.data) {
          return res.status(404).json({ ok: false, error: "Guest chart data not found" });
        }
        person2ChartData = existingChart.data;
        console.log("Using existing guest chart data for:", existingChart.name);
      } else {
        const partnerDateStr = partner.date;
        const [partnerDatePart] = partnerDateStr.split("T");
        const [partnerYear, partnerMonth, partnerDay] = partnerDatePart.split("-").map(Number);
        const [partnerLocalHours = 12, partnerLocalMinutes = 0] = (partner.time || "12:00").split(":").map(Number);
        const partnerCoords = await geocodeCityWithFallback(partner.place);
        const partnerTimezone = partner.timezone || "UTC";
        const partnerLocalDateTimeStr = `${partnerYear}-${String(partnerMonth).padStart(2, "0")}-${String(partnerDay).padStart(2, "0")} ${String(partnerLocalHours).padStart(2, "0")}:${String(partnerLocalMinutes).padStart(2, "0")}:00`;
        const partnerLocalDateTime = dayjs3.tz(partnerLocalDateTimeStr, partnerTimezone);
        const partnerUtcDateTime = partnerLocalDateTime.utc();
        person2ChartData = await calculateNatalChartPython({
          year: partnerUtcDateTime.year(),
          month: partnerUtcDateTime.month() + 1,
          day: partnerUtcDateTime.date(),
          hour: partnerUtcDateTime.hour(),
          minute: partnerUtcDateTime.minute(),
          latitude: partnerCoords.lat,
          longitude: partnerCoords.lon,
          house_system: "Placidus"
        });
        const newGuestChart = await storage.createExternalNatal({
          ownerId: userId,
          name: partner.name,
          gender: partner.gender || "other",
          birthdayDate: new Date(partner.date),
          birthTime: partner.time || null,
          birthPlace: partner.place || null,
          timezone: partner.timezone || "UTC",
          data: person2ChartData
        });
        finalGuestChartId = newGuestChart.id;
        console.log("Created new guest chart for:", partner.name);
      }
      const person1Chart = {
        planets: Object.entries(person1ChartData.planets).map(([name, data]) => ({
          name,
          sign: data.sign,
          position: data.longitude
        })),
        houses: person1ChartData.houses,
        angles: person1ChartData.angles,
        aspects: []
        // Aspects calculated by Python
      };
      const person2Chart = {
        planets: Object.entries(person2ChartData.planets).map(([name, data]) => ({
          name,
          sign: data.sign,
          position: data.longitude
        })),
        houses: person2ChartData.houses,
        angles: person2ChartData.angles,
        aspects: []
      };
      console.log("Person 1 chart planets:", person1Chart.planets.length);
      console.log("Person 2 chart planets:", person2Chart.planets.length);
      let analysis;
      let professionalInterpretation = null;
      let houseOverlays = null;
      if (professional) {
        try {
          const { calculateHouseOverlays: calculateHouseOverlays2 } = await Promise.resolve().then(() => (init_natalService(), natalService_exports));
          houseOverlays = calculateHouseOverlays2(person2ChartData.planets, person1ChartData.houses);
          const { getProfessionalCompatibilityInterpretation: getProfessionalCompatibilityInterpretation2 } = await Promise.resolve().then(() => (init_openai(), openai_exports));
          const compatibilityData = {
            person1: {
              planets: person1ChartData.planets,
              houses: person1ChartData.houses,
              angles: person1ChartData.angles
            },
            person2: {
              planets: person2ChartData.planets,
              houses: person2ChartData.houses,
              angles: person2ChartData.angles
            },
            houseOverlays,
            host_name: user.name,
            partner_name: partner.name
          };
          professionalInterpretation = await getProfessionalCompatibilityInterpretation2(compatibilityData, locale);
          analysis = professionalInterpretation.summary || "Professional compatibility analysis";
        } catch (error) {
          console.error("Failed to generate professional compatibility:", error);
          analysis = await getAstrologyInterpretation("compatibility", {
            host_name: user.name,
            partner_name: partner.name,
            person1: person1Chart,
            person2: person2Chart
          }, locale, user.gender);
        }
      } else {
        analysis = await getAstrologyInterpretation("compatibility", {
          host_name: user.name,
          host_gender: user.gender,
          partner_name: partner.name,
          partner_gender: partner.gender || "other",
          relationship_type: relationshipType,
          person1: person1Chart,
          person2: person2Chart
        }, locale, user.gender);
      }
      let compatibilityRating = null;
      let cleanedAnalysis = analysis;
      const ratingMatch = analysis.match(/RATING:\s*(\d+\.?\d*)/i);
      if (ratingMatch) {
        compatibilityRating = parseFloat(ratingMatch[1]).toFixed(2);
        cleanedAnalysis = analysis.replace(/RATING:\s*\d+\.?\d*\s*/i, "").trim();
      }
      await storage.createCompatibilityReading({
        userId,
        partnerName: partner.name,
        partnerGender: partner.gender || "other",
        partnerDate: new Date(partner.date),
        relationshipType,
        guestChartId: finalGuestChartId || null,
        analysis: cleanedAnalysis,
        compatibilityRating,
        isProfessional: professional,
        professionalInterpretation,
        houseOverlays
      });
      const featureName = professional ? "compatibility_professional" : "compatibility";
      await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
      await storage.createUsageLog({ userId, feature: featureName, cost });
      const strengths = locale === "ru" ? [
        "\u0421\u0438\u043B\u044C\u043D\u0430\u044F \u044D\u043C\u043E\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0432\u044F\u0437\u044C \u0438 \u043F\u043E\u043D\u0438\u043C\u0430\u043D\u0438\u0435",
        "\u041E\u0431\u0449\u0438\u0435 \u0446\u0435\u043D\u043D\u043E\u0441\u0442\u0438 \u0438 \u0436\u0438\u0437\u043D\u0435\u043D\u043D\u044B\u0435 \u0446\u0435\u043B\u0438",
        "\u041E\u0442\u043B\u0438\u0447\u043D\u0430\u044F \u043A\u043E\u043C\u043C\u0443\u043D\u0438\u043A\u0430\u0446\u0438\u044F \u0438 \u0434\u043E\u0432\u0435\u0440\u0438\u0435"
      ] : [
        "Strong emotional connection and understanding",
        "Shared values and life goals",
        "Excellent communication and trust"
      ];
      const challenges = locale === "ru" ? [
        "\u0420\u0430\u0437\u043D\u044B\u0435 \u043F\u043E\u0434\u0445\u043E\u0434\u044B \u043A \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u044E \u043A\u043E\u043D\u0444\u043B\u0438\u043A\u0442\u043E\u0432",
        "\u0411\u0430\u043B\u0430\u043D\u0441 \u043C\u0435\u0436\u0434\u0443 \u043D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u044C\u044E \u0438 \u0431\u043B\u0438\u0437\u043E\u0441\u0442\u044C\u044E"
      ] : [
        "Different approaches to conflict resolution",
        "Balance independence with togetherness"
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
          challenges
        }
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/astrology/ask", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const { question } = req.body;
      const locale = req.body.locale || "en";
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart || !natalChart.data) {
        return res.status(409).json({ ok: false, error: "NATAL_NOT_INITIALIZED" });
      }
      const cost = ENERGY_COSTS.ask;
      if (user.freeEnergy + user.purchasedEnergy < cost) {
        return res.status(400).json({ ok: false, error: "Insufficient energy" });
      }
      const answer = await getAstrologyInterpretation("ask", {
        chart: natalChart.data,
        question
      }, locale, user.gender);
      await storage.createAiQuestion({
        userId,
        question,
        answer
      });
      await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
      await storage.createUsageLog({ userId, feature: "ask", cost });
      res.json({ ok: true, data: { answer } });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/astrology/natal/history", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const limit = parseInt(req.query.limit) || 10;
      const readings = await storage.getNatalReadingsByUserId(userId, limit);
      res.json({ ok: true, data: readings });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/compatibility/history", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const limit = parseInt(req.query.limit) || 50;
      await storage.deleteOldCompatibilityReadings(userId);
      const readings = await storage.getCompatibilityReadingsByUserId(userId, limit);
      res.json({ ok: true, data: readings });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/compatibility/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const reading = await storage.getCompatibilityReading(id);
      if (!reading) {
        return res.status(404).json({ ok: false, error: "Compatibility reading not found" });
      }
      if (reading.userId !== userId) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }
      res.json({ ok: true, data: reading });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.delete("/api/compatibility/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const reading = await storage.getCompatibilityReading(id);
      if (!reading) {
        return res.status(404).json({ ok: false, error: "Compatibility reading not found" });
      }
      if (reading.userId !== userId) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }
      await storage.deleteCompatibilityReading(id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/astrology/horoscope/history", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const limit = parseInt(req.query.limit) || 10;
      const readings = await storage.getHoroscopeReadingsByUserId(userId, limit);
      res.json({ ok: true, data: readings });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/astrology/compatibility/history", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const limit = parseInt(req.query.limit) || 10;
      const readings = await storage.getCompatibilityReadingsByUserId(userId, limit);
      res.json({ ok: true, data: readings });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/astrology/ask/history", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const limit = parseInt(req.query.limit) || 20;
      const questions = await storage.getAiQuestionsByUserId(userId, limit);
      res.json({ ok: true, data: questions });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/astrology/important-dates", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart) {
        return res.status(400).json({ ok: false, error: "Natal chart required. Please create your natal chart first." });
      }
      const chartData = natalChart.data;
      const natalPlanets = extractNatalPlanets(chartData);
      const now = /* @__PURE__ */ new Date();
      const futureDate = /* @__PURE__ */ new Date();
      futureDate.setDate(now.getDate() + 90);
      const events = await findImportantEvents(natalPlanets, {
        from: now,
        to: futureDate,
        limit: 20
      });
      const unlocked = await storage.getImportantDateUnlocksByUserId(userId);
      const unlockedKeys = new Set(unlocked.map((u) => u.eventKey));
      const eventsWithStatus = events.map((event) => ({
        ...event,
        unlocked: unlockedKeys.has(event.key)
      }));
      res.json({ ok: true, data: eventsWithStatus });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/astrology/important-dates/unlock", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const { eventKey } = req.body;
      if (!eventKey) {
        return res.status(400).json({ ok: false, error: "Event key is required" });
      }
      const existing = await storage.getImportantDateUnlockByUserAndKey(userId, eventKey);
      if (existing) {
        return res.json({ ok: true, data: existing });
      }
      const unlock = await storage.createImportantDateUnlock({
        userId,
        eventKey
      });
      res.json({ ok: true, data: unlock });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/astrology/important-dates/detail", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const { eventKey, locale = "ru" } = req.body;
      if (!eventKey) {
        return res.status(400).json({ ok: false, error: "Event key is required" });
      }
      await checkAndResetEnergy(storage, userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }
      const cost = ENERGY_COSTS.important_date_detail;
      if (user.freeEnergy + user.purchasedEnergy < cost) {
        return res.status(400).json({ ok: false, error: "Insufficient energy" });
      }
      const natalChart = await storage.getNatalChart(userId);
      if (!natalChart) {
        return res.status(400).json({ ok: false, error: "Natal chart required" });
      }
      const chartData = natalChart.data;
      const natalPlanets = extractNatalPlanets(chartData);
      const now = /* @__PURE__ */ new Date();
      const futureDate = /* @__PURE__ */ new Date();
      futureDate.setDate(now.getDate() + 90);
      const events = await findImportantEvents(natalPlanets, {
        from: now,
        to: futureDate,
        limit: 20
      });
      const event = events.find((e) => e.key === eventKey);
      if (!event) {
        return res.status(404).json({ ok: false, error: "Event not found" });
      }
      const natalSummary = {
        planets: Object.entries(chartData.planets).map(([name, data]) => ({
          name,
          sign: data.sign,
          house: 1
          // Houses not calculated in current version
        })),
        ascendant: chartData.angles?.ascendant
      };
      const interpretationInput = {
        profile: {
          name: user.name,
          age: (/* @__PURE__ */ new Date()).getFullYear() - new Date(user.birthdayDate).getFullYear(),
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
      const interpretation = await interpretImportantDate(interpretationInput, locale);
      await storage.updateUser(userId, { purchasedEnergy: user.purchasedEnergy - cost });
      await storage.createUsageLog({ userId, feature: "important_date_detail", cost });
      const unlock = await storage.getImportantDateUnlockByUserAndKey(userId, eventKey);
      if (unlock) {
        await storage.updateImportantDateUnlock(unlock.id, {
          interpretation
        });
      }
      res.json({ ok: true, data: interpretation });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/payments/history", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const payments2 = await storage.getPaymentsByUserId(userId);
      res.json({ ok: true, data: payments2 });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/payments/ton/check-pending", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const allPayments = await storage.getAllPayments();
      const pendingPayments = allPayments.filter(
        (p) => p.userId === userId && p.status === "pending" && p.kind === "energy_pack"
      );
      if (pendingPayments.length === 0) {
        return res.json({ ok: true, message: "No pending payments", found: 0 });
      }
      console.log(`[CHECK_PENDING] Found ${pendingPayments.length} pending payments for user ${userId}`);
      const walletAddress = process.env.TON_WALLET_ADDRESS;
      if (!walletAddress) {
        return res.status(500).json({ ok: false, error: "Payment system not configured" });
      }
      let foundCount = 0;
      let creditedEnergy = 0;
      for (const payment of pendingPayments) {
        if (!payment.userWalletAddress) {
          console.log("[CHECK_PENDING] Skipping payment without user wallet address:", payment.id);
          continue;
        }
        const amountInNanoTON = (parseFloat(payment.amountTON || "0") * 1e9).toFixed(0);
        const { findUserTransaction: findUserTransaction2 } = await Promise.resolve().then(() => (init_ton(), ton_exports));
        const matchedTx = await findUserTransaction2(
          payment.userWalletAddress,
          walletAddress,
          amountInNanoTON,
          60,
          // Check last 60 minutes (very generous)
          /* @__PURE__ */ new Set()
        );
        if (matchedTx) {
          foundCount++;
          const user = await storage.getUser(userId);
          if (user && payment.energyAmount) {
            await storage.updateUser(userId, {
              purchasedEnergy: (user.purchasedEnergy || 0) + payment.energyAmount
            });
            creditedEnergy += payment.energyAmount;
          }
          await storage.updatePayment(payment.id, {
            status: "completed",
            txHash: matchedTx.hash
          });
          console.log("[CHECK_PENDING] \u2705 Found and credited payment:", payment.id);
        }
      }
      res.json({
        ok: true,
        message: `Checked ${pendingPayments.length} payments, found ${foundCount}`,
        found: foundCount,
        creditedEnergy
      });
    } catch (error) {
      console.error("[CHECK_PENDING] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/referral/code", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const rewards = await storage.getReferralRewardsByReferrerId(user.id);
      const referralsWithDetails = await Promise.all(
        rewards.map(async (reward) => {
          const referredUser = await storage.getUser(reward.referredUserId);
          return {
            id: reward.id,
            userName: referredUser?.name || "Unknown",
            rewardType: reward.rewardType,
            energyAmount: reward.energyAmount,
            createdAt: reward.createdAt
          };
        })
      );
      res.json({
        ok: true,
        data: {
          referralCode: user.referralCode,
          referrals: referralsWithDetails,
          totalRewards: rewards.reduce((sum, r) => sum + r.energyAmount, 0),
          totalReferrals: rewards.filter((r) => r.rewardType === "signup").length
        }
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/referral/validate/:code", async (req, res) => {
    try {
      const { code } = req.params;
      if (!code || code.trim() === "") {
        return res.json({
          ok: true,
          data: {
            valid: false,
            referrer: null
          }
        });
      }
      const referrer = await storage.getUserByReferralCode(code.trim());
      if (!referrer) {
        return res.json({
          ok: true,
          data: {
            valid: false,
            referrer: null
          }
        });
      }
      res.json({
        ok: true,
        data: {
          valid: true,
          referrer: {
            name: referrer.name,
            username: referrer.username || null
          }
        }
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/payments/price", async (req, res) => {
    try {
      const tonRate = await getTonPrice();
      res.json({
        ok: true,
        data: {
          tonRate,
          subscriptions: {
            standard: { usd: 9, ton: (9 / tonRate).toFixed(2) },
            pro: { usd: 15, ton: (15 / tonRate).toFixed(2) }
          },
          energyPacks: {
            small: { amount: 20, usd: 2.99, ton: (2.99 / tonRate).toFixed(2) },
            medium: { amount: 50, usd: 5.99, ton: (5.99 / tonRate).toFixed(2) },
            large: { amount: 120, usd: 11.99, ton: (11.99 / tonRate).toFixed(2) }
          }
        }
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  const createPaymentSchema = z3.object({
    kind: z3.enum(["energy_pack", "subscription"]),
    tier: z3.enum(["standard", "pro"]).optional(),
    energyAmount: z3.number().optional(),
    amountUSD: z3.number(),
    userWalletAddress: z3.string().optional()
    // TON wallet address of sender
  });
  app2.post("/api/payments/ton/create", requireAuth, async (req, res) => {
    const fs4 = await import("fs");
    const logData = `

[${(/* @__PURE__ */ new Date()).toISOString()}] TON_CREATE REQUEST
UserID: ${req.userId}
Body: ${JSON.stringify(req.body, null, 2)}
`;
    fs4.appendFileSync("/tmp/ton-debug.log", logData);
    console.log("=====================================");
    console.log("[TON_CREATE] Request received:", { userId: req.userId, body: req.body });
    console.log("=====================================");
    try {
      const userId = req.userId;
      const validated = createPaymentSchema.parse(req.body);
      if (!process.env.TON_WALLET_ADDRESS) {
        return res.status(500).json({
          ok: false,
          error: "Payment system not configured. Please contact support."
        });
      }
      const tonPrice = await getTonPrice();
      const amountTON = convertUSDToTON(validated.amountUSD, tonPrice);
      const normalizedUserAddress = validated.userWalletAddress ? normalizeTonAddress(validated.userWalletAddress) : null;
      console.log("[TON_CREATE] Payment details:", {
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
        amountTON: (parseFloat(amountTON) / 1e9).toString(),
        txHash: `pending_${Date.now()}`,
        status: "pending",
        userWalletAddress: normalizedUserAddress
      });
      res.json({
        ok: true,
        data: {
          paymentId: payment.id,
          walletAddress: process.env.TON_WALLET_ADDRESS,
          amountTON
        }
      });
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ ok: false, error: error.errors[0].message });
      }
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  const confirmTonPaymentSchema = z3.object({
    paymentId: z3.string(),
    boc: z3.string().optional()
    // BOC not used, backend searches by amount/time
  });
  app2.post("/api/payments/ton/confirm", requireAuth, async (req, res) => {
    console.log("=====================================");
    console.log("[TON_CONFIRM] Request received:", { userId: req.userId, body: req.body });
    console.log("=====================================");
    try {
      const userId = req.userId;
      const validated = confirmTonPaymentSchema.parse(req.body);
      const payments2 = await storage.getAllPayments();
      const payment = payments2.find((p) => p.id === validated.paymentId && p.userId === userId);
      if (!payment) {
        return res.status(404).json({ ok: false, error: "Payment not found" });
      }
      if (payment.status === "completed") {
        console.log("[TON_CONFIRM] Payment already completed:", validated.paymentId);
        return res.json({ ok: true, message: "Already processed" });
      }
      const walletAddress = process.env.TON_WALLET_ADDRESS;
      if (!walletAddress) {
        console.error("[TON_CONFIRM] TON_WALLET_ADDRESS not configured");
        return res.status(500).json({ ok: false, error: "Payment system not configured" });
      }
      const usedTxHashes = new Set(
        payments2.filter((p) => p.status === "completed" && p.txHash && !p.txHash.startsWith("pending_")).map((p) => p.txHash)
      );
      const amountInNanoTON = (parseFloat(payment.amountTON || "0") * 1e9).toFixed(0);
      if (!payment.userWalletAddress) {
        console.error("[TON_CONFIRM] User wallet address not found in payment");
        return res.status(400).json({
          ok: false,
          error: "Payment missing user wallet address. Please try creating a new payment."
        });
      }
      console.log("[TON_CONFIRM] Searching for transaction FROM user wallet TO our wallet");
      console.log("[TON_CONFIRM] User wallet address:", payment.userWalletAddress);
      console.log("[TON_CONFIRM] Our wallet address:", walletAddress);
      console.log("[TON_CONFIRM] Expected amount:", amountInNanoTON, "nanoTON");
      const matchedTx = await findUserTransaction(
        payment.userWalletAddress,
        walletAddress,
        amountInNanoTON,
        15,
        // Extended to 15 minutes
        usedTxHashes
      );
      if (!matchedTx) {
        console.error("[TON_CONFIRM] No matching unused transaction found on blockchain");
        return res.status(400).json({
          ok: false,
          error: "Transaction not found on blockchain. Please wait a few seconds and try again."
        });
      }
      if (payment.kind === "energy_pack" && payment.energyAmount) {
        const user = await storage.getUser(userId);
        if (user) {
          await storage.updateUser(userId, {
            purchasedEnergy: (user.purchasedEnergy || 0) + payment.energyAmount
          });
          console.log("[TON_CONFIRM] Energy credited:", payment.energyAmount, "to user:", userId);
        }
      }
      await storage.updatePayment(validated.paymentId, {
        status: "completed",
        txHash: matchedTx.hash
      });
      console.log("[TON_CONFIRM] Payment verified and completed:", {
        paymentId: validated.paymentId,
        txHash: matchedTx.hash,
        amount: matchedTx.amount
      });
      res.json({
        ok: true,
        message: "Payment confirmed",
        txHash: matchedTx.hash
      });
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ ok: false, error: error.errors[0].message });
      }
      console.error("[TON_CONFIRM] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allPayments = await storage.getAllPayments();
      const allSubscriptions = await storage.getAllSubscriptions();
      const totalRevenue = allPayments.filter((p) => p.status === "confirmed" || p.status === "completed").reduce((sum, p) => sum + parseFloat(p.amountUSD), 0);
      const activeSubscriptions = allSubscriptions.filter((s) => s.status === "active").length;
      const stats = {
        totalUsers: allUsers.length,
        totalRevenue: totalRevenue.toFixed(2),
        activeSubscriptions,
        totalPayments: allPayments.length,
        recentUsers: allUsers.slice(0, 10)
      };
      res.json({ ok: true, data: stats });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users2 = await storage.getAllUsers();
      res.json({ ok: true, data: users2 });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  const updateEnergySchema = z3.object({
    energy: z3.number().int().min(0).max(1e3)
  });
  app2.post("/api/admin/users/:userId/energy", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const validated = updateEnergySchema.parse(req.body);
      await storage.updateUser(userId, { purchasedEnergy: validated.energy });
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ ok: false, error: error.errors[0].message });
      }
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  const updateSubscriptionSchema = z3.object({
    tier: z3.enum(["standard", "pro"]),
    status: z3.enum(["active", "canceled", "expired"])
  });
  app2.post("/api/admin/users/:userId/subscription", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const validated = updateSubscriptionSchema.parse(req.body);
      const existingSub = await storage.getSubscription(userId);
      const startedAt = /* @__PURE__ */ new Date();
      const currentPeriodEnd = dayjs3(startedAt).add(30, "days").toDate();
      if (existingSub) {
        await storage.updateSubscription(existingSub.id, {
          tier: validated.tier,
          status: validated.status,
          currentPeriodEnd
        });
      } else {
        await storage.createSubscription({
          userId,
          tier: validated.tier,
          status: validated.status,
          startedAt,
          currentPeriodEnd
        });
      }
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ ok: false, error: error.errors[0].message });
      }
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/api/payments/ton/webhook", async (req, res) => {
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
          status: "failed"
        });
        return res.status(400).json({ ok: false, error: "Transaction hash already used" });
      }
      if (!process.env.TON_WALLET_ADDRESS) {
        return res.status(500).json({ ok: false, error: "TON wallet address not configured" });
      }
      const isValid = await verifyTonTransaction(
        txHash,
        (parseFloat(payment.amountTON) * 1e9).toFixed(0),
        process.env.TON_WALLET_ADDRESS
      );
      if (!isValid) {
        await storage.updatePayment(paymentId, {
          txHash,
          status: "failed"
        });
        return res.status(400).json({ ok: false, error: "Invalid transaction" });
      }
      await storage.updatePayment(paymentId, {
        txHash,
        status: "confirmed"
      });
      if (payment.kind === "energy_pack" && payment.energyAmount) {
        const user = await storage.getUser(payment.userId);
        if (user) {
          await storage.updateUser(payment.userId, {
            purchasedEnergy: (user.purchasedEnergy || 0) + payment.energyAmount
          });
        }
      } else if (payment.kind === "subscription" && payment.tier) {
        if (payment.tier !== "standard" && payment.tier !== "pro") {
          return res.status(400).json({ ok: false, error: "Invalid subscription tier" });
        }
        const startedAt = /* @__PURE__ */ new Date();
        const currentPeriodEnd = dayjs3(startedAt).add(30, "days").toDate();
        const existingSub = await storage.getSubscription(payment.userId);
        if (existingSub) {
          await storage.updateSubscription(existingSub.id, {
            tier: payment.tier,
            status: "active",
            currentPeriodEnd
          });
        } else {
          await storage.createSubscription({
            userId: payment.userId,
            tier: payment.tier,
            status: "active",
            startedAt,
            currentPeriodEnd
          });
        }
        await handleSubscriptionReferralBonus(storage, payment.userId);
        const subscriptionEnergy = payment.tier === "standard" ? 100 : 250;
        const user = await storage.getUser(payment.userId);
        if (user) {
          await storage.updateUser(payment.userId, {
            purchasedEnergy: (user.purchasedEnergy || 0) + subscriptionEnergy
          });
        }
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  const createYooKassaPaymentSchema = z3.object({
    kind: z3.enum(["energy_pack", "subscription"]),
    pack: z3.object({
      energy: z3.number().refine((val) => [20, 50, 120].includes(val))
    }).optional(),
    tier: z3.enum(["standard", "pro"]).optional(),
    customerEmail: z3.string().email().optional().nullable()
  });
  app2.post("/api/payments/yookassa/create", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      console.log("[YooKassa] Creating payment for userId:", userId);
      const validated = createYooKassaPaymentSchema.parse(req.body);
      console.log("[YooKassa] Validated request:", validated);
      let description;
      let amountRUB;
      let energyAmount;
      let tier;
      if (validated.kind === "energy_pack" && validated.pack) {
        const packConfig = {
          20: { rub: "150.00", label: "20 Orbs Energy Pack" },
          50: { rub: "300.00", label: "50 Orbs Energy Pack" },
          120: { rub: "600.00", label: "120 Orbs Energy Pack" }
        }[validated.pack.energy];
        if (!packConfig) {
          console.error("[YooKassa] Invalid pack:", validated.pack.energy);
          return res.status(400).json({ ok: false, error: "Invalid energy pack" });
        }
        description = `\u041F\u043E\u043A\u0443\u043F\u043A\u0430 ${validated.pack.energy} \u043E\u0440\u0431\u043E\u0432 \u044D\u043D\u0435\u0440\u0433\u0438\u0438`;
        amountRUB = packConfig.rub;
        energyAmount = validated.pack.energy;
      } else if (validated.kind === "subscription" && validated.tier) {
        const tierConfig = {
          standard: { rub: "450.00", label: "Standard Subscription (1 month)" },
          pro: { rub: "750.00", label: "Pro Subscription (1 month)" }
        }[validated.tier];
        description = `\u041F\u043E\u0434\u043F\u0438\u0441\u043A\u0430 ${validated.tier === "standard" ? "Standard (100 \u043E\u0440\u0431\u043E\u0432/\u0434\u0435\u043D\u044C)" : "Pro (250 \u043E\u0440\u0431\u043E\u0432/\u0434\u0435\u043D\u044C)"} \u043D\u0430 1 \u043C\u0435\u0441\u044F\u0446`;
        amountRUB = tierConfig.rub;
        tier = validated.tier;
      } else {
        console.error("[YooKassa] Invalid request - missing pack or tier");
        return res.status(400).json({ ok: false, error: "Invalid request: must specify pack or tier" });
      }
      console.log("[YooKassa] Payment config:", { description, amountRUB, energyAmount, tier });
      const yookassaPayment = await storage.createYookassaPayment({
        userId,
        kind: validated.kind,
        tier,
        energyAmount,
        amountRUB,
        yookassaPaymentId: ""
        // Will be updated after YooKassa creates payment
      });
      console.log("[YooKassa] Payment record created with ID:", yookassaPayment.id);
      const baseUrl = process.env.SERVER_URL || `https://${req.headers.host}`;
      const returnUrl = `${baseUrl}/payment-success?paymentId=${yookassaPayment.id}`;
      const user = await storage.getUser(userId);
      const customerEmail = validated.customerEmail || (user?.tgId ? `tg${user.tgId}@astro-orb.app` : void 0);
      console.log("[YooKassa] Customer email for receipt:", customerEmail);
      const ykPayment = await createPayment({
        amount: amountRUB,
        description,
        returnUrl,
        customerEmail,
        metadata: {
          internalPaymentId: yookassaPayment.id,
          userId,
          kind: validated.kind,
          tier,
          energyAmount
        }
      });
      console.log("[YooKassa] YooKassa payment created:", ykPayment.id);
      await storage.updateYookassaPayment(yookassaPayment.id, {
        yookassaPaymentId: ykPayment.id
      });
      const confirmationUrl = ykPayment.confirmation?.confirmation_url;
      if (!confirmationUrl) {
        console.error("[YooKassa] No confirmation URL in response");
        return res.status(500).json({ ok: false, error: "Failed to get payment URL" });
      }
      console.log("[YooKassa] Payment created successfully, confirmation URL:", confirmationUrl);
      res.json({
        ok: true,
        data: {
          confirmationUrl,
          paymentId: yookassaPayment.id,
          yookassaPaymentId: ykPayment.id
        }
      });
    } catch (error) {
      if (error instanceof z3.ZodError) {
        console.error("[YooKassa] Validation error:", error.errors);
        return res.status(400).json({ ok: false, error: error.errors[0].message });
      }
      console.error("[YooKassa] Create payment error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.post("/webhooks/yookassa", async (req, res) => {
    try {
      const clientIP = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress || "";
      console.log("[YooKassa Webhook] Request received from IP:", clientIP);
      if (!verifyWebhookIP(clientIP)) {
        console.warn("[YooKassa Webhook] SECURITY: Request from unauthorized IP:", clientIP);
        return res.status(403).json({ ok: false, error: "Unauthorized IP" });
      }
      const payment = parseWebhookPayload(req.body);
      if (!payment) {
        console.error("[YooKassa Webhook] Invalid webhook payload");
        return res.status(400).json({ ok: false, error: "Invalid payload" });
      }
      console.log("[YooKassa Webhook] Payment succeeded:", payment.id);
      console.log("[YooKassa Webhook] Metadata:", payment.metadata);
      const internalPaymentId = payment.metadata?.internalPaymentId;
      if (!internalPaymentId) {
        console.error("[YooKassa Webhook] No internal payment ID in metadata");
        return res.status(400).json({ ok: false, error: "Missing payment ID" });
      }
      const dbPayment = await storage.getYookassaPaymentById(internalPaymentId);
      if (!dbPayment) {
        console.error("[YooKassa Webhook] Payment not found in database:", internalPaymentId);
        return res.status(404).json({ ok: false, error: "Payment not found" });
      }
      if (dbPayment.status === "completed") {
        console.log("[YooKassa Webhook] Payment already processed:", dbPayment.id);
        return res.json({ ok: true, message: "Already processed" });
      }
      console.log("[YooKassa Webhook] Processing payment:", dbPayment.id);
      console.log("[YooKassa Webhook] Payment kind:", dbPayment.kind);
      if (dbPayment.kind === "energy_pack" && dbPayment.energyAmount) {
        console.log("[YooKassa Webhook] Processing energy pack:", dbPayment.energyAmount, "orbs");
        const user = await storage.getUser(dbPayment.userId);
        if (user) {
          const oldEnergy = user.purchasedEnergy || 0;
          const newEnergy = oldEnergy + dbPayment.energyAmount;
          await storage.updateUser(dbPayment.userId, {
            purchasedEnergy: newEnergy
          });
          console.log(`[YooKassa Webhook] \u2713 Credited energy: ${oldEnergy} \u2192 ${newEnergy} (user: ${dbPayment.userId})`);
        }
      } else if (dbPayment.kind === "subscription" && dbPayment.tier) {
        const tier = dbPayment.tier;
        const startedAt = /* @__PURE__ */ new Date();
        const currentPeriodEnd = dayjs3(startedAt).add(30, "days").toDate();
        const existingSub = await storage.getSubscription(dbPayment.userId);
        if (existingSub) {
          await storage.updateSubscription(existingSub.id, {
            tier,
            status: "active",
            currentPeriodEnd
          });
        } else {
          await storage.createSubscription({
            userId: dbPayment.userId,
            tier,
            status: "active",
            startedAt,
            currentPeriodEnd
          });
        }
        const subscriptionEnergy = tier === "standard" ? 100 : 250;
        const user = await storage.getUser(dbPayment.userId);
        if (user) {
          await storage.updateUser(dbPayment.userId, {
            purchasedEnergy: (user.purchasedEnergy || 0) + subscriptionEnergy
          });
        }
        await handleSubscriptionReferralBonus(storage, dbPayment.userId);
        console.log(`[YooKassa Webhook] Activated ${tier} subscription for user ${dbPayment.userId}`);
      }
      await storage.updateYookassaPayment(dbPayment.id, {
        status: "completed",
        completedAt: /* @__PURE__ */ new Date()
      });
      console.log("[YooKassa Webhook] Payment completed successfully");
      res.json({ ok: true });
    } catch (error) {
      console.error("[YooKassa Webhook] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/api/admin/yookassa/payments", requireAdmin, async (req, res) => {
    try {
      const payments2 = await storage.getYookassaPaymentsByUserId("");
      res.json({
        ok: true,
        payments: []
      });
    } catch (error) {
      console.error("[Admin] YooKassa payments error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  app2.get("/.well-known/tonconnect-manifest.json", (req, res) => {
    res.json({
      url: process.env.SERVER_URL || "https://astro-orb.replit.app",
      name: "Astro Orb",
      iconUrl: `${process.env.SERVER_URL || "https://astro-orb.replit.app"}/icon.png`
    });
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs3 from "fs";
import path5 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path4 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      ),
      await import("@replit/vite-plugin-dev-banner").then(
        (m) => m.devBanner()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path4.resolve(import.meta.dirname, "client", "src"),
      "@shared": path4.resolve(import.meta.dirname, "shared"),
      "@assets": path4.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path4.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path4.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid as nanoid2 } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path5.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs3.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid2()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path5.resolve(import.meta.dirname, "public");
  if (!fs3.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path5.resolve(distPath, "index.html"));
  });
}

// server/index.ts
init_db();
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path6 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path6.startsWith("/api")) {
      let logLine = `${req.method} ${path6} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  app.get("/health", (_req, res) => {
    console.log("[Health] Health check requested");
    res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  console.log("[STARTUP] Starting application initialization...");
  const REQUIRED_SECRETS = ["SESSION_SECRET", "JWT_SECRET", "DATABASE_URL", "TELEGRAM_BOT_TOKEN"];
  const missingSecrets = REQUIRED_SECRETS.filter((secret) => !process.env[secret]);
  if (missingSecrets.length > 0) {
    console.error(`[STARTUP] WARNING: Missing required environment variables: ${missingSecrets.join(", ")}`);
    console.error("[STARTUP] Some features may not work correctly. Please configure secrets in the Replit Secrets panel");
  } else {
    console.log("[STARTUP] \u2713 All required secrets configured");
  }
  let server;
  try {
    console.log("[STARTUP] Registering routes...");
    server = await registerRoutes(app);
    console.log("[STARTUP] \u2713 Routes registered successfully");
  } catch (error) {
    console.error("[STARTUP] ERROR: Failed to register routes:", error.message);
    console.error("[STARTUP] Error stack:", error.stack);
    console.error("[STARTUP] Creating fallback HTTP server for diagnostics");
    app.all("/api/*", (_req, res) => {
      res.status(503).json({
        ok: false,
        error: "Service temporarily unavailable",
        details: "Server started but API routes failed to register. Check deployment logs."
      });
    });
    server = createServer2(app);
  }
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  const appEnv = app.get("env");
  console.log('app.get("env"):', appEnv);
  console.log("process.env.NODE_ENV:", process.env.NODE_ENV);
  try {
    if (appEnv === "development") {
      console.log("Setting up Vite in development mode");
      await setupVite(app, server);
    } else {
      console.log("Serving static files in production mode");
      serveStatic(app);
    }
  } catch (error) {
    console.error("[STARTUP] ERROR: Failed to setup Vite/static files:", error.message);
    console.error("[STARTUP] Server will start but file serving may not work");
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  console.log(`[STARTUP] Starting server on port ${port} (host: 0.0.0.0)...`);
  try {
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true
    }, () => {
      console.log(`[STARTUP] \u2705 SERVER READY - listening on port ${port}`);
      console.log(`[STARTUP] Health check available at: /health`);
      log(`serving on port ${port}`);
    });
  } catch (error) {
    console.error(`[STARTUP] FATAL: Failed to start server on port ${port}:`, error.message);
    process.exit(1);
  }
  const gracefulShutdown = (signal) => {
    console.log(`
[SHUTDOWN] ${signal} received. Starting graceful shutdown...`);
    server.close(() => {
      console.log("[SHUTDOWN] HTTP server closed");
      if (pool) {
        pool.end().then(() => {
          console.log("[SHUTDOWN] Database pool closed");
          process.exit(0);
        }).catch((err) => {
          console.error("[SHUTDOWN] Error closing database pool:", err);
          process.exit(1);
        });
      } else {
        process.exit(0);
      }
    });
    setTimeout(() => {
      console.error("[SHUTDOWN] Forced shutdown after timeout");
      process.exit(1);
    }, 3e4);
  };
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
})();
