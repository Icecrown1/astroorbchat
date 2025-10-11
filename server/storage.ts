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
  type InsertAiQuestion
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

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
  
  // Compatibility reading operations
  createCompatibilityReading(reading: InsertCompatibilityReading): Promise<CompatibilityReading>;
  getCompatibilityReadingsByUserId(userId: string, limit?: number): Promise<CompatibilityReading[]>;
  
  // AI question operations
  createAiQuestion(question: InsertAiQuestion): Promise<AiQuestion>;
  getAiQuestionsByUserId(userId: string, limit?: number): Promise<AiQuestion[]>;
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

  // Compatibility reading operations
  async createCompatibilityReading(insertReading: InsertCompatibilityReading): Promise<CompatibilityReading> {
    const [reading] = await db
      .insert(compatibilityReadings)
      .values(insertReading)
      .returning();
    return reading;
  }

  async getCompatibilityReadingsByUserId(userId: string, limit: number = 10): Promise<CompatibilityReading[]> {
    return await db
      .select()
      .from(compatibilityReadings)
      .where(eq(compatibilityReadings.userId, userId))
      .orderBy(desc(compatibilityReadings.createdAt))
      .limit(limit);
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
}

export const storage = new DatabaseStorage();
