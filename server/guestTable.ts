import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { users, tarotReadings } from "@shared/schema";
import { db } from "./db";
import { ORB_COSTS } from "./lib/energy";

export function guestReadingId(user: string, table: string) {
  return createHash("sha256")
    .update("guest-table:" + user + ":" + table)
    .digest("hex");
}
export async function previousGuestReading(id: string, user: string) {
  const [row] = await db
    .select()
    .from(tarotReadings)
    .where(and(eq(tarotReadings.id, id), eq(tarotReadings.userId, user)));
  return row;
}

export async function saveGuestReading(
  data: typeof tarotReadings.$inferInsert,
  subscriptionActive: boolean,
) {
  const cost = ORB_COSTS.tarot_three;
  return db.transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(users)
      .where(eq(users.id, data.userId))
      .for("update");
    if (!account) return null;
    const [prior] = await tx
      .select()
      .from(tarotReadings)
      .where(eq(tarotReadings.id, data.id!));
    if (prior) return prior;
    const fromSubscription = subscriptionActive
      ? Math.min(Number(account.subscriptionOrbs), cost)
      : 0;
    const fromReferral = cost - fromSubscription;
    if (Number(account.referralOrbs) < fromReferral) return null;
    await tx
      .update(users)
      .set({
        subscriptionOrbs: sql`${users.subscriptionOrbs}-${fromSubscription}`,
        referralOrbs: sql`${users.referralOrbs}-${fromReferral}`,
      })
      .where(eq(users.id, data.userId));
    const [saved] = await tx.insert(tarotReadings).values(data).returning();
    return saved;
  });
}
