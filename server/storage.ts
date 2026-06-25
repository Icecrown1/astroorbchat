// Reference: blueprint:javascript_database
import { 
  users, 
  subscriptions,
  payments,
  usageLogs,
  natalReadings,
  horoscopeReadings,
  compatibilityReadings,
  aiQuestions,
  natalCharts,
  externalNatals,
  importantDateUnlocks,
  importantDateInterpretations,
  yookassaPayments,
  referralRewards,
  solarReturns,
  leads,
  webhookErrors,
  type User, 
  type InsertUser,
  type Subscription,
  type InsertSubscription,
  type Payment,
  type InsertPayment,
  type UsageLog,
  type InsertUsageLog,
  type NatalReading,
  type InsertNatalReading,
  type HoroscopeReading,
  type InsertHoroscopeReading,
  type CompatibilityReading,
  type InsertCompatibilityReading,
  type AiQuestion,
  type InsertAiQuestion,
  type NatalChart,
  type InsertNatalChart,
  type ExternalNatal,
  type InsertExternalNatal,
  type ImportantDateUnlock,
  type InsertImportantDateUnlock,
  type ImportantDateInterpretation,
  type InsertImportantDateInterpretation,
  type YookassaPayment,
  type InsertYookassaPayment,
  type ReferralReward,
  type InsertReferralReward,
  type SolarReturn,
  type InsertSolarReturn,
  type Lead,
  type InsertLead,
  type WebhookError,
  type InsertWebhookError,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, isNull, lt, ne } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByTgId(tgId: string): Promise<User | undefined>;
  getUserByReferralCode(code: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  
  // Subscription operations
  getSubscription(userId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription | undefined>;
  
  // Payment operations
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentByTxHash(txHash: string): Promise<Payment | undefined>;
  getPaymentsByUserId(userId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined>;
  
  // Usage log operations
  createUsageLog(log: InsertUsageLog): Promise<UsageLog>;
  getUsageLogsByUserId(userId: string, limit?: number): Promise<UsageLog[]>;
  
  // Natal reading operations
  createNatalReading(reading: InsertNatalReading): Promise<NatalReading>;
  getNatalReadingsByUserId(userId: string, limit?: number): Promise<NatalReading[]>;
  
  // Horoscope reading operations
  createHoroscopeReading(reading: InsertHoroscopeReading): Promise<HoroscopeReading>;
  getHoroscopeReadingsByUserId(userId: string, limit?: number): Promise<HoroscopeReading[]>;
  deleteHoroscopeReading(id: string): Promise<void>;
  
  // Compatibility reading operations
  createCompatibilityReading(reading: InsertCompatibilityReading): Promise<CompatibilityReading>;
  getCompatibilityReading(id: string): Promise<CompatibilityReading | undefined>;
  getCompatibilityReadingsByUserId(userId: string, limit?: number): Promise<CompatibilityReading[]>;
  deleteCompatibilityReading(id: string): Promise<void>;
  deleteOldCompatibilityReadings(userId: string): Promise<number>;
  
  // AI question operations
  createAiQuestion(question: InsertAiQuestion): Promise<AiQuestion>;
  getAiQuestionsByUserId(userId: string, limit?: number): Promise<AiQuestion[]>;
  
  // Natal chart operations
  getNatalChart(userId: string): Promise<NatalChart | undefined>;
  createNatalChart(chart: InsertNatalChart): Promise<NatalChart>;
  updateNatalChart(userId: string, data: Partial<NatalChart>): Promise<NatalChart | undefined>;
  deleteNatalChart(userId: string): Promise<void>;
  
  // External natal operations
  getExternalNatal(id: string): Promise<ExternalNatal | undefined>;
  getExternalNatalsByOwnerId(ownerId: string): Promise<ExternalNatal[]>;
  createExternalNatal(natal: InsertExternalNatal): Promise<ExternalNatal>;
  deleteExternalNatal(id: string): Promise<void>;
  
  // Important Date Unlock operations
  getImportantDateUnlockByUserAndKey(userId: string, eventKey: string): Promise<ImportantDateUnlock | undefined>;
  getImportantDateUnlocksByUserId(userId: string): Promise<ImportantDateUnlock[]>;
  createImportantDateUnlock(unlock: InsertImportantDateUnlock): Promise<ImportantDateUnlock>;
  updateImportantDateUnlock(id: string, data: Partial<ImportantDateUnlock>): Promise<ImportantDateUnlock | undefined>;
  
  // Important Date Interpretation cache operations
  getImportantDateInterpretation(userId: string, eventType: string, date: string, sign: string, locale: string): Promise<ImportantDateInterpretation | undefined>;
  saveImportantDateInterpretation(userId: string, eventType: string, date: string, sign: string, locale: string, interpretation: string): Promise<ImportantDateInterpretation>;
  
  // YooKassa payment operations
  createYookassaPayment(payment: InsertYookassaPayment): Promise<YookassaPayment>;
  getYookassaPaymentById(yookassaPaymentId: string): Promise<YookassaPayment | undefined>;
  getYookassaPaymentByInternalId(id: string): Promise<YookassaPayment | undefined>;
  getYookassaPaymentByIdempotencyKey(idempotencyKey: string): Promise<YookassaPayment | undefined>;
  getYookassaPaymentsByUserId(userId: string): Promise<YookassaPayment[]>;
  updateYookassaPayment(paymentId: string, data: Partial<YookassaPayment>): Promise<YookassaPayment | undefined>;
  deleteYookassaPayment(yookassaPaymentId: string): Promise<void>;
  deleteYookassaPaymentByInternalId(id: string): Promise<void>;
  
  // Referral reward operations
  createReferralReward(reward: InsertReferralReward): Promise<ReferralReward>;
  getReferralRewardsByReferrerId(referrerId: string): Promise<ReferralReward[]>;
  getReferralReward(id: string): Promise<ReferralReward | undefined>;
  claimReferralChoiceAtomic(params: { rewardId: string; referrerId: string; rewardKind: string; subscriptionDays: number; days: number; dbTier: "standard" | "pro"; monthlyOrbs: number; }): Promise<{ claimed: boolean; currentPeriodEnd?: Date }>;
  
  // Solar return operations
  getSolarReturn(userId: string, targetYear: number, location: string): Promise<SolarReturn | undefined>;
  createSolarReturn(solarReturn: InsertSolarReturn): Promise<SolarReturn>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  getAllPayments(): Promise<Payment[]>;
  getAllSubscriptions(): Promise<Subscription[]>;
  addPurchasedEnergy(userId: string, amount: number): Promise<User | undefined>;
  
  // Lead magnet operations
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, data: Partial<Lead>): Promise<Lead | undefined>;
  markLeadConverted(leadId: string, userId: string): Promise<Lead | undefined>;

  // Webhook error logging
  logWebhookError(data: InsertWebhookError): Promise<WebhookError>;

  // Reconciliation: pending YooKassa payments older than N minutes (with a real YK payment ID)
  getPendingYookassaPayments(olderThanMinutes: number): Promise<YookassaPayment[]>;
  getPendingTonPayments(olderThanMinutes: number): Promise<Payment[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByTgId(tgId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.tgId, tgId));
    return user || undefined;
  }

  async getUserByReferralCode(code: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, code));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  // Subscription operations
  async getSubscription(userId: string): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    return subscription || undefined;
  }

  async createSubscription(insertSubscription: InsertSubscription): Promise<Subscription> {
    const [subscription] = await db
      .insert(subscriptions)
      .values(insertSubscription)
      .returning();
    return subscription;
  }

  async updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription | undefined> {
    const [subscription] = await db
      .update(subscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return subscription || undefined;
  }

  // Payment operations
  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id));
    return payment || undefined;
  }

  async getPaymentByTxHash(txHash: string): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.txHash, txHash));
    return payment || undefined;
  }

  async getPaymentsByUserId(userId: string): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db
      .insert(payments)
      .values(insertPayment)
      .returning();
    return payment;
  }

  async updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined> {
    const [payment] = await db
      .update(payments)
      .set(data)
      .where(eq(payments.id, id))
      .returning();
    return payment || undefined;
  }

  // Usage log operations
  async createUsageLog(insertLog: InsertUsageLog): Promise<UsageLog> {
    const [log] = await db
      .insert(usageLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async getUsageLogsByUserId(userId: string, limit: number = 50): Promise<UsageLog[]> {
    return await db
      .select()
      .from(usageLogs)
      .where(eq(usageLogs.userId, userId))
      .orderBy(desc(usageLogs.createdAt))
      .limit(limit);
  }

  // Natal reading operations
  async createNatalReading(insertReading: InsertNatalReading): Promise<NatalReading> {
    const [reading] = await db
      .insert(natalReadings)
      .values(insertReading)
      .returning();
    return reading;
  }

  async getNatalReadingsByUserId(userId: string, limit: number = 10): Promise<NatalReading[]> {
    return await db
      .select()
      .from(natalReadings)
      .where(eq(natalReadings.userId, userId))
      .orderBy(desc(natalReadings.createdAt))
      .limit(limit);
  }

  // Horoscope reading operations
  async createHoroscopeReading(insertReading: InsertHoroscopeReading): Promise<HoroscopeReading> {
    const [reading] = await db
      .insert(horoscopeReadings)
      .values(insertReading)
      .returning();
    return reading;
  }

  async getHoroscopeReadingsByUserId(userId: string, limit: number = 10): Promise<HoroscopeReading[]> {
    return await db
      .select()
      .from(horoscopeReadings)
      .where(eq(horoscopeReadings.userId, userId))
      .orderBy(desc(horoscopeReadings.createdAt))
      .limit(limit);
  }

  async deleteHoroscopeReading(id: string): Promise<void> {
    await db
      .delete(horoscopeReadings)
      .where(eq(horoscopeReadings.id, id));
  }

  // Compatibility reading operations
  async createCompatibilityReading(insertReading: InsertCompatibilityReading): Promise<CompatibilityReading> {
    const [reading] = await db
      .insert(compatibilityReadings)
      .values(insertReading)
      .returning();
    return reading;
  }

  async getCompatibilityReading(id: string): Promise<CompatibilityReading | undefined> {
    const [reading] = await db
      .select()
      .from(compatibilityReadings)
      .where(eq(compatibilityReadings.id, id));
    return reading || undefined;
  }

  async getCompatibilityReadingsByUserId(userId: string, limit: number = 10): Promise<CompatibilityReading[]> {
    return await db
      .select()
      .from(compatibilityReadings)
      .where(eq(compatibilityReadings.userId, userId))
      .orderBy(desc(compatibilityReadings.createdAt))
      .limit(limit);
  }

  async deleteCompatibilityReading(id: string): Promise<void> {
    await db.delete(compatibilityReadings).where(eq(compatibilityReadings.id, id));
  }

  async deleteOldCompatibilityReadings(userId: string): Promise<number> {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const result = await db
      .delete(compatibilityReadings)
      .where(
        and(
          eq(compatibilityReadings.userId, userId),
          lt(compatibilityReadings.createdAt, twoWeeksAgo)
        )
      );
    
    return result.rowCount || 0;
  }

  // AI question operations
  async createAiQuestion(insertQuestion: InsertAiQuestion): Promise<AiQuestion> {
    const [question] = await db
      .insert(aiQuestions)
      .values(insertQuestion)
      .returning();
    return question;
  }

  async getAiQuestionsByUserId(userId: string, limit: number = 20): Promise<AiQuestion[]> {
    return await db
      .select()
      .from(aiQuestions)
      .where(eq(aiQuestions.userId, userId))
      .orderBy(desc(aiQuestions.createdAt))
      .limit(limit);
  }

  // Natal chart operations
  async getNatalChart(userId: string): Promise<NatalChart | undefined> {
    const [chart] = await db
      .select()
      .from(natalCharts)
      .where(eq(natalCharts.userId, userId));
    return chart || undefined;
  }

  async createNatalChart(insertChart: InsertNatalChart): Promise<NatalChart> {
    const [chart] = await db
      .insert(natalCharts)
      .values(insertChart)
      .returning();
    return chart;
  }

  async updateNatalChart(userId: string, data: Partial<NatalChart>): Promise<NatalChart | undefined> {
    const [chart] = await db
      .update(natalCharts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(natalCharts.userId, userId))
      .returning();
    return chart || undefined;
  }

  async deleteNatalChart(userId: string): Promise<void> {
    await db
      .delete(natalCharts)
      .where(eq(natalCharts.userId, userId));
  }

  // External natal operations
  async getExternalNatal(id: string): Promise<ExternalNatal | undefined> {
    const [natal] = await db
      .select()
      .from(externalNatals)
      .where(eq(externalNatals.id, id));
    return natal || undefined;
  }

  async getExternalNatalsByOwnerId(ownerId: string): Promise<ExternalNatal[]> {
    return await db
      .select()
      .from(externalNatals)
      .where(eq(externalNatals.ownerId, ownerId))
      .orderBy(desc(externalNatals.createdAt));
  }

  async createExternalNatal(insertNatal: InsertExternalNatal): Promise<ExternalNatal> {
    const [natal] = await db
      .insert(externalNatals)
      .values(insertNatal)
      .returning();
    return natal;
  }

  async deleteExternalNatal(id: string): Promise<void> {
    await db
      .delete(externalNatals)
      .where(eq(externalNatals.id, id));
  }

  async updateExternalNatal(id: string, data: Partial<ExternalNatal>): Promise<ExternalNatal | undefined> {
    const [natal] = await db
      .update(externalNatals)
      .set(data)
      .where(eq(externalNatals.id, id))
      .returning();
    return natal || undefined;
  }

  // Important Date Unlock operations
  async getImportantDateUnlockByUserAndKey(userId: string, eventKey: string): Promise<ImportantDateUnlock | undefined> {
    const [unlock] = await db
      .select()
      .from(importantDateUnlocks)
      .where(and(eq(importantDateUnlocks.userId, userId), eq(importantDateUnlocks.eventKey, eventKey)));
    return unlock || undefined;
  }

  async getImportantDateUnlocksByUserId(userId: string): Promise<ImportantDateUnlock[]> {
    return await db
      .select()
      .from(importantDateUnlocks)
      .where(eq(importantDateUnlocks.userId, userId))
      .orderBy(desc(importantDateUnlocks.createdAt));
  }

  async createImportantDateUnlock(insertUnlock: InsertImportantDateUnlock): Promise<ImportantDateUnlock> {
    const [unlock] = await db
      .insert(importantDateUnlocks)
      .values(insertUnlock)
      .returning();
    return unlock;
  }

  async updateImportantDateUnlock(id: string, data: Partial<ImportantDateUnlock>): Promise<ImportantDateUnlock | undefined> {
    const [unlock] = await db
      .update(importantDateUnlocks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(importantDateUnlocks.id, id))
      .returning();
    return unlock || undefined;
  }

  // Important Date Interpretation cache operations
  async getImportantDateInterpretation(
    userId: string,
    eventType: string,
    date: string,
    sign: string,
    locale: string
  ): Promise<ImportantDateInterpretation | undefined> {
    const [interpretation] = await db
      .select()
      .from(importantDateInterpretations)
      .where(
        and(
          eq(importantDateInterpretations.userId, userId),
          eq(importantDateInterpretations.eventType, eventType),
          eq(importantDateInterpretations.date, date),
          eq(importantDateInterpretations.sign, sign),
          eq(importantDateInterpretations.locale, locale)
        )
      );
    
    // Check if interpretation is still valid (within 7 days TTL)
    if (interpretation) {
      const now = new Date();
      const createdAt = new Date(interpretation.createdAt);
      const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 7) {
        // Cache expired, delete it
        await db
          .delete(importantDateInterpretations)
          .where(eq(importantDateInterpretations.id, interpretation.id));
        return undefined;
      }
    }
    
    return interpretation || undefined;
  }

  async saveImportantDateInterpretation(
    userId: string,
    eventType: string,
    date: string,
    sign: string,
    locale: string,
    interpretation: string
  ): Promise<ImportantDateInterpretation> {
    const [saved] = await db
      .insert(importantDateInterpretations)
      .values({
        userId,
        eventType,
        date,
        sign,
        locale,
        interpretation,
      })
      .returning();
    return saved;
  }

  // YooKassa payment operations
  async createYookassaPayment(insertPayment: InsertYookassaPayment): Promise<YookassaPayment> {
    const [payment] = await db
      .insert(yookassaPayments)
      .values(insertPayment)
      .returning();
    return payment;
  }

  async getYookassaPaymentById(yookassaPaymentId: string): Promise<YookassaPayment | undefined> {
    const [payment] = await db
      .select()
      .from(yookassaPayments)
      .where(eq(yookassaPayments.yookassaPaymentId, yookassaPaymentId));
    return payment || undefined;
  }

  async getYookassaPaymentByInternalId(id: string): Promise<YookassaPayment | undefined> {
    const [payment] = await db
      .select()
      .from(yookassaPayments)
      .where(eq(yookassaPayments.id, id));
    return payment || undefined;
  }

  async getYookassaPaymentByIdempotencyKey(idempotencyKey: string): Promise<YookassaPayment | undefined> {
    const [payment] = await db
      .select()
      .from(yookassaPayments)
      .where(eq(yookassaPayments.idempotencyKey, idempotencyKey));
    return payment || undefined;
  }

  async getYookassaPaymentsByUserId(userId: string): Promise<YookassaPayment[]> {
    return await db
      .select()
      .from(yookassaPayments)
      .where(eq(yookassaPayments.userId, userId))
      .orderBy(desc(yookassaPayments.createdAt));
  }

  async updateYookassaPayment(paymentId: string, data: Partial<YookassaPayment>): Promise<YookassaPayment | undefined> {
    const [payment] = await db
      .update(yookassaPayments)
      .set(data)
      .where(eq(yookassaPayments.id, paymentId))
      .returning();
    return payment || undefined;
  }

  async deleteYookassaPayment(yookassaPaymentId: string): Promise<void> {
    await db
      .delete(yookassaPayments)
      .where(eq(yookassaPayments.id, yookassaPaymentId));
  }

  async deleteYookassaPaymentByInternalId(id: string): Promise<void> {
    await db
      .delete(yookassaPayments)
      .where(eq(yookassaPayments.id, id));
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async getAllPayments(): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt));
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return await db
      .select()
      .from(subscriptions)
      .orderBy(desc(subscriptions.createdAt));
  }

  async addPurchasedEnergy(userId: string, amount: number): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const [updated] = await db
      .update(users)
      .set({ 
        purchasedEnergy: user.purchasedEnergy + amount, 
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  // Referral reward operations
  async createReferralReward(reward: InsertReferralReward): Promise<ReferralReward> {
    const [newReward] = await db.insert(referralRewards).values(reward).returning();
    return newReward;
  }

  async getReferralRewardsByReferrerId(referrerId: string): Promise<ReferralReward[]> {
    return await db
      .select()
      .from(referralRewards)
      .where(eq(referralRewards.referrerId, referrerId))
      .orderBy(desc(referralRewards.createdAt));
  }

  async getReferralReward(id: string): Promise<ReferralReward | undefined> {
    const [reward] = await db
      .select()
      .from(referralRewards)
      .where(eq(referralRewards.id, id));
    return reward;
  }

  // Atomically claim a pending referral choice reward AND apply its subscription/orbs
  // in a single transaction. Either everything commits or nothing does — preventing both
  // double-claim races and the "reward consumed but benefits never granted" failure mode.
  // The conditional claim (WHERE reward_kind='pending_choice') ensures only one concurrent
  // caller can succeed; a second caller re-evaluates the WHERE against the committed row and
  // matches nothing.
  async claimReferralChoiceAtomic(params: {
    rewardId: string;
    referrerId: string;
    rewardKind: string;
    subscriptionDays: number;
    days: number;
    dbTier: "standard" | "pro";
    monthlyOrbs: number;
  }): Promise<{ claimed: boolean; currentPeriodEnd?: Date }> {
    return await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(referralRewards)
        .set({ rewardKind: params.rewardKind, subscriptionDays: params.subscriptionDays })
        .where(and(
          eq(referralRewards.id, params.rewardId),
          eq(referralRewards.referrerId, params.referrerId),
          eq(referralRewards.rewardKind, "pending_choice")
        ))
        .returning();

      if (!claimed) {
        return { claimed: false };
      }

      const now = new Date();
      const DAY_MS = 24 * 60 * 60 * 1000;

      const [existingSub] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, params.referrerId))
        .limit(1);

      let currentPeriodEnd: Date;
      if (
        existingSub?.currentPeriodEnd &&
        new Date(existingSub.currentPeriodEnd).getTime() > now.getTime() &&
        existingSub.status === "active"
      ) {
        currentPeriodEnd = new Date(new Date(existingSub.currentPeriodEnd).getTime() + params.days * DAY_MS);
      } else {
        currentPeriodEnd = new Date(now.getTime() + params.days * DAY_MS);
      }

      if (existingSub) {
        await tx
          .update(subscriptions)
          .set({ tier: params.dbTier, status: "active", currentPeriodEnd })
          .where(eq(subscriptions.id, existingSub.id));
      } else {
        await tx.insert(subscriptions).values({
          userId: params.referrerId,
          tier: params.dbTier,
          status: "active",
          startedAt: now,
          currentPeriodEnd,
        });
      }

      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, params.referrerId))
        .limit(1);

      if (user && parseFloat(user.subscriptionOrbs ?? "0") <= 0) {
        await tx
          .update(users)
          .set({
            subscriptionOrbs: params.monthlyOrbs.toString(),
            orbsResetAt: new Date(now.getTime() + 30 * DAY_MS),
          })
          .where(eq(users.id, params.referrerId));
      }

      return { claimed: true, currentPeriodEnd };
    });
  }

  // Solar return operations
  // NOTE: location parameter must be pre-normalized (trim + toLowerCase) by caller
  async getSolarReturn(userId: string, targetYear: number, location: string): Promise<SolarReturn | undefined> {
    const [solarReturn] = await db
      .select()
      .from(solarReturns)
      .where(and(
        eq(solarReturns.userId, userId), 
        eq(solarReturns.targetYear, targetYear),
        eq(solarReturns.location, location)
      ));
    return solarReturn || undefined;
  }

  async createSolarReturn(insertSolarReturn: InsertSolarReturn): Promise<SolarReturn> {
    const [solarReturn] = await db
      .insert(solarReturns)
      .values(insertSolarReturn)
      .returning();
    return solarReturn;
  }

  // Lead magnet operations
  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db
      .insert(leads)
      .values(insertLead)
      .returning();
    return lead;
  }

  async updateLead(id: string, data: Partial<Lead>): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set(data)
      .where(eq(leads.id, id))
      .returning();
    return lead || undefined;
  }

  async markLeadConverted(leadId: string, userId: string): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set({ 
        convertedToUserId: userId,
        convertedAt: new Date()
      })
      .where(eq(leads.id, leadId))
      .returning();
    return lead || undefined;
  }

  async logWebhookError(data: InsertWebhookError): Promise<WebhookError> {
    const [record] = await db
      .insert(webhookErrors)
      .values(data)
      .returning();
    return record;
  }

  async getPendingYookassaPayments(olderThanMinutes: number): Promise<YookassaPayment[]> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    return await db
      .select()
      .from(yookassaPayments)
      .where(
        and(
          ne(yookassaPayments.status, 'completed'),
          ne(yookassaPayments.status, 'canceled'),
          lt(yookassaPayments.createdAt, cutoff)
        )
      )
      .orderBy(yookassaPayments.createdAt);
  }

  async getPendingTonPayments(olderThanMinutes: number): Promise<Payment[]> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    return await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, 'pending'),
          lt(payments.createdAt, cutoff)
        )
      )
      .orderBy(payments.createdAt);
  }
}

export const storage = new DatabaseStorage();
