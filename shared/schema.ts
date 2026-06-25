import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, index, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Solar returns table (defined early for usersRelations reference)
export const solarReturns = pgTable("solar_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  targetYear: integer("target_year").notNull(),
  location: text("location").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("solar_returns_user_id_idx").on(table.userId),
  userYearLocationIdx: index("solar_returns_user_year_location_idx").on(table.userId, table.targetYear, table.location),
}));

export const users = pgTable("users", {
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
  // New orb system: subscriptionOrbs = monthly orbs for Standard (250/month), referralOrbs = orbs from referrals
  subscriptionOrbs: decimal("subscription_orbs", { precision: 10, scale: 1 }).notNull().default("0"),
  referralOrbs: decimal("referral_orbs", { precision: 10, scale: 1 }).notNull().default("0"),
  orbsResetAt: timestamp("orbs_reset_at").notNull().defaultNow(),
  // Legacy fields - kept for migration, can be removed later
  freeEnergy: integer("free_energy").notNull().default(0),
  purchasedEnergy: integer("purchased_energy").notNull().default(0),
  energyResetAt: timestamp("energy_reset_at").notNull().defaultNow(),
  lastProfileUpdate: timestamp("last_profile_update"),
  referralCode: varchar("referral_code", { length: 20 }).notNull().unique(),
  referredById: varchar("referred_by_id", { length: 255 }),
  isAdmin: boolean("is_admin").notNull().default(false),
  natalChart: jsonb("natal_chart"),
}, (table) => ({
  tgIdIdx: index("users_tg_id_idx").on(table.tgId),
  referralCodeIdx: index("users_referral_code_idx").on(table.referralCode),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  referredBy: one(users, {
    fields: [users.referredById],
    references: [users.id],
    relationName: "UserReferrals",
  }),
  referrals: many(users, {
    relationName: "UserReferrals",
  }),
  payments: many(payments),
  usageLogs: many(usageLogs),
  referralRewardsGiven: many(referralRewards, {
    relationName: "ReferrerRewards",
  }),
  referralRewardsReceived: many(referralRewards, {
    relationName: "ReferredUserRewards",
  }),
  natalChart: one(natalCharts, {
    fields: [users.id],
    references: [natalCharts.userId],
  }),
  externalNatals: many(externalNatals),
  importantDateUnlocks: many(importantDateUnlocks),
  importantDateInterpretations: many(importantDateInterpretations),
  yookassaPayments: many(yookassaPayments),
  solarReturns: many(solarReturns),
}));

export const natalCharts = pgTable("natal_charts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  data: jsonb("data").notNull(),
  natalSunLongitude: decimal("natal_sun_longitude", { precision: 10, scale: 6 }),
  professionalInterpretation: jsonb("professional_interpretation"),
  houseInfluences: jsonb("house_influences"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("natal_charts_user_id_idx").on(table.userId),
}));

export const natalChartsRelations = relations(natalCharts, ({ one }) => ({
  user: one(users, {
    fields: [natalCharts.userId],
    references: [users.id],
  }),
}));

export const externalNatals = pgTable("external_natals", {
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  ownerIdIdx: index("external_natals_owner_id_idx").on(table.ownerId),
}));

export const externalNatalsRelations = relations(externalNatals, ({ one }) => ({
  owner: one(users, {
    fields: [externalNatals.ownerId],
    references: [users.id],
  }),
}));

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  tier: varchar("tier", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  startedAt: timestamp("started_at").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Auto-renewal fields
  autoRenew: boolean("auto_renew").notNull().default(false), // User opted into auto-renewal
  paymentMethodId: varchar("payment_method_id", { length: 255 }), // YooKassa saved payment method for recurring
  paymentProvider: varchar("payment_provider", { length: 20 }), // 'yookassa', 'ton', 'stars'
  periodMonths: integer("period_months").notNull().default(1), // 1, 6, or 12 months
  amountRUB: decimal("amount_rub", { precision: 10, scale: 2 }), // Price for renewal
  lastRenewalNotification: timestamp("last_renewal_notification"), // Prevent duplicate notifications
}, (table) => ({
  userIdIdx: index("subscriptions_user_id_idx").on(table.userId),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  kind: varchar("kind", { length: 50 }).notNull(),
  tier: varchar("tier", { length: 20 }),
  energyAmount: integer("energy_amount"),
  amountUSD: decimal("amount_usd", { precision: 10, scale: 2 }).notNull(),
  amountTON: decimal("amount_ton", { precision: 18, scale: 9 }).notNull(),
  txHash: varchar("tx_hash", { length: 255 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull(),
  userWalletAddress: varchar("user_wallet_address", { length: 255 }), // TON wallet address of the sender
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  txHashIdx: index("payments_tx_hash_idx").on(table.txHash),
  userIdIdx: index("payments_user_id_idx").on(table.userId),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
}));

export const usageLogs = pgTable("usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  feature: varchar("feature", { length: 50 }).notNull(),
  cost: integer("cost").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("usage_logs_user_id_idx").on(table.userId),
}));

export const usageLogsRelations = relations(usageLogs, ({ one }) => ({
  user: one(users, {
    fields: [usageLogs.userId],
    references: [users.id],
  }),
}));

export const referralRewards = pgTable("referral_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id", { length: 255 }).notNull(),
  referredUserId: varchar("referred_user_id", { length: 255 }).notNull(),
  rewardType: varchar("reward_type", { length: 20 }).notNull(), // 'signup' or 'subscription'
  energyAmount: integer("energy_amount").notNull(),
  // New fields for different reward types based on subscription tier
  rewardKind: varchar("reward_kind", { length: 30 }).notNull().default("orbs"), // 'orbs', 'subscription_standard_days', 'subscription_premium_days'
  subscriptionDays: integer("subscription_days"), // Days of subscription granted (for free users)
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  referrerIdIdx: index("referral_rewards_referrer_id_idx").on(table.referrerId),
}));

export const referralRewardsRelations = relations(referralRewards, ({ one }) => ({
  referrer: one(users, {
    fields: [referralRewards.referrerId],
    references: [users.id],
    relationName: "ReferrerRewards",
  }),
  referredUser: one(users, {
    fields: [referralRewards.referredUserId],
    references: [users.id],
    relationName: "ReferredUserRewards",
  }),
}));

export const natalReadings = pgTable("natal_readings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  planets: jsonb("planets").notNull(),
  aspects: jsonb("aspects").notNull(),
  interpretation: text("interpretation").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("natal_readings_user_id_idx").on(table.userId),
}));

export const natalReadingsRelations = relations(natalReadings, ({ one }) => ({
  user: one(users, {
    fields: [natalReadings.userId],
    references: [users.id],
  }),
}));

export const horoscopeReadings = pgTable("horoscope_readings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  period: varchar("period", { length: 20 }).notNull(),
  startDate: varchar("start_date", { length: 10 }),
  endDate: varchar("end_date", { length: 10 }),
  forecast: text("forecast").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("horoscope_readings_user_id_idx").on(table.userId),
}));

export const horoscopeReadingsRelations = relations(horoscopeReadings, ({ one }) => ({
  user: one(users, {
    fields: [horoscopeReadings.userId],
    references: [users.id],
  }),
}));

export const compatibilityReadings = pgTable("compatibility_readings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  partnerName: text("partner_name").notNull(),
  partnerGender: varchar("partner_gender", { length: 20 }).default('other'),
  partnerDate: timestamp("partner_date").notNull(),
  relationshipType: varchar("relationship_type", { length: 20 }).notNull().default('romantic'),
  guestChartId: varchar("guest_chart_id", { length: 255 }),
  analysis: text("analysis").notNull(),
  compatibilityRating: decimal("compatibility_rating", { precision: 4, scale: 2 }),
  isProfessional: boolean("is_professional").notNull().default(false),
  professionalInterpretation: jsonb("professional_interpretation"),
  houseOverlays: jsonb("house_overlays"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("compatibility_readings_user_id_idx").on(table.userId),
  guestChartIdIdx: index("compatibility_readings_guest_chart_id_idx").on(table.guestChartId),
}));

export const compatibilityReadingsRelations = relations(compatibilityReadings, ({ one }) => ({
  user: one(users, {
    fields: [compatibilityReadings.userId],
    references: [users.id],
  }),
}));

export const aiQuestions = pgTable("ai_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("ai_questions_user_id_idx").on(table.userId),
}));

export const aiQuestionsRelations = relations(aiQuestions, ({ one }) => ({
  user: one(users, {
    fields: [aiQuestions.userId],
    references: [users.id],
  }),
}));

export const solarReturnsRelations = relations(solarReturns, ({ one }) => ({
  user: one(users, {
    fields: [solarReturns.userId],
    references: [users.id],
  }),
}));

export const importantDateUnlocks = pgTable("important_date_unlocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  eventKey: text("event_key").notNull(),
  interpretation: jsonb("interpretation"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("important_date_unlocks_user_id_idx").on(table.userId),
  userEventIdx: index("important_date_unlocks_user_event_idx").on(table.userId, table.eventKey),
}));

export const importantDateUnlocksRelations = relations(importantDateUnlocks, ({ one }) => ({
  user: one(users, {
    fields: [importantDateUnlocks.userId],
    references: [users.id],
  }),
}));

export const importantDateInterpretations = pgTable("important_date_interpretations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(), // "new_moon", "full_moon", "planet_transit"
  date: varchar("date", { length: 50 }).notNull(), // ISO date string
  sign: varchar("sign", { length: 50 }).notNull(), // Zodiac sign
  locale: varchar("locale", { length: 10 }).notNull().default('ru'), // "ru" or "en"
  interpretation: text("interpretation").notNull(), // AI-generated text
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("important_date_interpretations_user_id_idx").on(table.userId),
  cacheKeyIdx: index("important_date_interpretations_cache_key_idx").on(table.userId, table.eventType, table.date, table.sign, table.locale),
}));

export const importantDateInterpretationsRelations = relations(importantDateInterpretations, ({ one }) => ({
  user: one(users, {
    fields: [importantDateInterpretations.userId],
    references: [users.id],
  }),
}));

export const yookassaPayments = pgTable("yookassa_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  kind: varchar("kind", { length: 50 }).notNull(), // "energy_pack" or "subscription"
  tier: varchar("tier", { length: 20 }), // For subscriptions: "standard" or "pro"
  energyAmount: integer("energy_amount"), // For energy packs
  amountRUB: decimal("amount_rub", { precision: 10, scale: 2 }).notNull(),
  yookassaPaymentId: varchar("yookassa_payment_id", { length: 255 }).unique(), // YooKassa payment ID - must be unique (null allowed for pending payments)
  idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull().unique(), // Client-provided idempotency key - must be unique
  status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, succeeded, canceled
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  userIdIdx: index("yookassa_payments_user_id_idx").on(table.userId),
  idempotencyKeyIdx: index("yookassa_payments_idempotency_key_idx").on(table.idempotencyKey),
}));

export const yookassaPaymentsRelations = relations(yookassaPayments, ({ one }) => ({
  user: one(users, {
    fields: [yookassaPayments.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users, {
  tgId: z.string().min(1),
  name: z.string().min(1),
  gender: z.enum(["male", "female", "other"]),
  age: z.number().int().min(1).max(150),
  birthdayDate: z.date().or(z.string()),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  timezone: z.string(),
  referralCode: z.string(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  freeEnergy: true,
  purchasedEnergy: true,
  energyResetAt: true,
  referredById: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions, {
  userId: z.string(),
  tier: z.enum(["standard", "pro"]),
  status: z.enum(["active", "canceled", "expired"]),
  startedAt: z.date().or(z.string()),
  currentPeriodEnd: z.date().or(z.string()),
  autoRenew: z.boolean().optional(),
  paymentMethodId: z.string().optional().nullable(),
  paymentProvider: z.enum(["yookassa", "ton", "stars"]).optional().nullable(),
  periodMonths: z.number().int().min(1).max(12).optional(),
  amountRUB: z.string().or(z.number()).optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRenewalNotification: true,
});

export const insertPaymentSchema = createInsertSchema(payments, {
  userId: z.string(),
  kind: z.enum(["subscription", "energy_pack"]),
  tier: z.enum(["standard", "pro"]).optional().nullable(),
  energyAmount: z.number().int().positive().optional().nullable(),
  amountUSD: z.string().or(z.number()),
  amountTON: z.string().or(z.number()),
  txHash: z.string(),
  status: z.enum(["pending", "confirmed", "failed"]),
}).omit({
  id: true,
  createdAt: true,
});

export const insertUsageLogSchema = createInsertSchema(usageLogs, {
  userId: z.string(),
  feature: z.enum(["natal", "solar", "horoscope", "compatibility", "ask", "natal_external", "important_date_detail", "natal_professional", "compatibility_professional", "weekly_plan", "monthly_plan"]),
  cost: z.number().int().positive(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertNatalReadingSchema = createInsertSchema(natalReadings, {
  userId: z.string(),
  planets: z.any(),
  aspects: z.any(),
  interpretation: z.string(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertHoroscopeReadingSchema = createInsertSchema(horoscopeReadings, {
  userId: z.string(),
  period: z.string(),
  forecast: z.string(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertCompatibilityReadingSchema = createInsertSchema(compatibilityReadings, {
  userId: z.string(),
  partnerName: z.string(),
  partnerGender: z.enum(["male", "female", "other"]).default("other"),
  partnerDate: z.date().or(z.string()),
  relationshipType: z.enum(["romantic", "friendship", "work", "family"]).default("romantic"),
  guestChartId: z.string().optional().nullable(),
  analysis: z.string(),
  isProfessional: z.boolean().optional(),
  professionalInterpretation: z.any().optional(),
  houseOverlays: z.any().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertAiQuestionSchema = createInsertSchema(aiQuestions, {
  userId: z.string(),
  question: z.string(),
  answer: z.string(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertNatalChartSchema = createInsertSchema(natalCharts, {
  userId: z.string(),
  data: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExternalNatalSchema = createInsertSchema(externalNatals, {
  ownerId: z.string(),
  name: z.string().min(1),
  gender: z.enum(["male", "female", "other"]),
  birthdayDate: z.date().or(z.string()),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  timezone: z.string(),
  data: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertImportantDateUnlockSchema = createInsertSchema(importantDateUnlocks, {
  userId: z.string(),
  eventKey: z.string(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertImportantDateInterpretationSchema = createInsertSchema(importantDateInterpretations, {
  userId: z.string(),
  eventType: z.enum(["new_moon", "full_moon", "planet_transit"]),
  date: z.string(),
  sign: z.string(),
  locale: z.string().default('ru'),
  interpretation: z.string(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertYookassaPaymentSchema = createInsertSchema(yookassaPayments, {
  userId: z.string(),
  kind: z.enum(["energy_pack", "subscription", "subscription_upgrade", "subscription_renewal"]),
  tier: z.string().optional(),
  energyAmount: z.number().optional(),
  amountRUB: z.string(), // Decimal as string
  yookassaPaymentId: z.string().nullable(),
  idempotencyKey: z.string().min(1).max(64), // Required
}).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  status: true,
});

// Webhook error log — captures failed/partial webhook processing for debugging
export const webhookErrors = pgTable("webhook_errors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentId: varchar("payment_id", { length: 255 }), // internal or external payment ID
  provider: varchar("provider", { length: 50 }).notNull(), // 'yookassa', 'ton', 'stars'
  errorMessage: text("error_message").notNull(),
  payload: jsonb("payload"), // raw webhook body for replay
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  providerIdx: index("webhook_errors_provider_idx").on(table.provider),
  createdAtIdx: index("webhook_errors_created_at_idx").on(table.createdAt),
}));

export const insertWebhookErrorSchema = createInsertSchema(webhookErrors, {
  provider: z.string(),
  errorMessage: z.string(),
}).omit({ id: true, createdAt: true });

export type WebhookError = typeof webhookErrors.$inferSelect;
export type InsertWebhookError = z.infer<typeof insertWebhookErrorSchema>;

// Instagram Lead Magnet table - stores leads from landing page before they join Telegram
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  gender: varchar("gender", { length: 20 }).notNull(),
  birthdayDate: timestamp("birthday_date").notNull(),
  birthTime: varchar("birth_time", { length: 5 }),
  birthPlace: text("birth_place"),
  timezone: varchar("timezone", { length: 100 }).notNull().default("Europe/Moscow"),
  email: text("email"),
  instagramUsername: text("instagram_username"),
  natalChart: jsonb("natal_chart"), // Cached natal chart calculation
  horoscope: jsonb("horoscope"), // Cached generated horoscope
  convertedToUserId: varchar("converted_to_user_id", { length: 255 }), // Linked user after Telegram join
  source: varchar("source", { length: 50 }).default("instagram"), // Traffic source tracking
  createdAt: timestamp("created_at").notNull().defaultNow(),
  convertedAt: timestamp("converted_at"), // When user joined Telegram
}, (table) => ({
  emailIdx: index("leads_email_idx").on(table.email),
  convertedUserIdx: index("leads_converted_user_idx").on(table.convertedToUserId),
}));

export const insertLeadSchema = createInsertSchema(leads, {
  name: z.string().min(1).max(100),
  gender: z.enum(["male", "female"]),
  birthdayDate: z.coerce.date(),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  birthPlace: z.string().min(1).optional().nullable(),
  timezone: z.string().default("Europe/Moscow"),
  email: z.string().email().optional().nullable(),
  instagramUsername: z.string().optional().nullable(),
  source: z.string().default("instagram"),
}).omit({
  id: true,
  natalChart: true,
  horoscope: true,
  convertedToUserId: true,
  createdAt: true,
  convertedAt: true,
});

// Select types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type UsageLog = typeof usageLogs.$inferSelect;
export type InsertUsageLog = z.infer<typeof insertUsageLogSchema>;

export type NatalReading = typeof natalReadings.$inferSelect;
export type InsertNatalReading = z.infer<typeof insertNatalReadingSchema>;

export type HoroscopeReading = typeof horoscopeReadings.$inferSelect;
export type InsertHoroscopeReading = z.infer<typeof insertHoroscopeReadingSchema>;

export type CompatibilityReading = typeof compatibilityReadings.$inferSelect;
export type InsertCompatibilityReading = z.infer<typeof insertCompatibilityReadingSchema>;

export type AiQuestion = typeof aiQuestions.$inferSelect;
export type InsertAiQuestion = z.infer<typeof insertAiQuestionSchema>;

export type NatalChart = typeof natalCharts.$inferSelect;
export type InsertNatalChart = z.infer<typeof insertNatalChartSchema>;

export type ExternalNatal = typeof externalNatals.$inferSelect;
export type InsertExternalNatal = z.infer<typeof insertExternalNatalSchema>;

export type ImportantDateUnlock = typeof importantDateUnlocks.$inferSelect;
export type InsertImportantDateUnlock = z.infer<typeof insertImportantDateUnlockSchema>;

export type ImportantDateInterpretation = typeof importantDateInterpretations.$inferSelect;
export type InsertImportantDateInterpretation = z.infer<typeof insertImportantDateInterpretationSchema>;

export type YookassaPayment = typeof yookassaPayments.$inferSelect;
export type InsertYookassaPayment = z.infer<typeof insertYookassaPaymentSchema>;

export const insertReferralRewardSchema = createInsertSchema(referralRewards).omit({ id: true, createdAt: true });
export type ReferralReward = typeof referralRewards.$inferSelect;
export type InsertReferralReward = z.infer<typeof insertReferralRewardSchema>;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
