import { sql } from 'drizzle-orm';
import { db } from './db';
import { settleMobileMonth } from './mobileShop';

// Shell only. Called after verifying the test DB and merchant configuration.
export async function sandboxOperation([name, arg]: string[]) {
  if (name === 'review-setup' && /^[a-f0-9]{64}$/.test(arg ?? '')) {
    if (process.env.ANDROID_REVIEW_CODE_SHA256) throw Error('Review access already configured in Secrets');
    await db.execute(sql`CREATE TABLE IF NOT EXISTS android_review_access (
      slot text PRIMARY KEY CHECK(slot='review'), digest char(64) NOT NULL)`);
    await db.execute(sql`INSERT INTO android_review_access VALUES ('review',${arg}) ON CONFLICT DO NOTHING`);
    const saved = await db.execute(sql`SELECT 1 FROM android_review_access WHERE slot='review' AND digest=${arg}`);
    if (saved.rowCount !== 1) throw Error('An existing review credential was preserved');
    return { configured: true };
  }
  if (name === 'reports') {
    return (await db.execute(sql`SELECT id,kind,created_at FROM android_reading_feedback WHERE reviewed_at IS NULL
      UNION ALL SELECT id,'saved-reading',created_at FROM events WHERE name='mobile_content_report' ORDER BY created_at LIMIT 100`)).rows;
  }
  if (['inspect','reviewed'].includes(name) && /^[a-f0-9]{64}$/.test(arg ?? '')) {
    if (name === 'inspect') return (await db.execute(sql`SELECT kind,excerpt FROM android_reading_feedback WHERE id=${arg}
      UNION ALL SELECT name,value FROM events WHERE id=${arg} AND name='mobile_content_report'`)).rows;
    return db.transaction(async tx => {
      const a = await tx.execute(sql`UPDATE android_reading_feedback SET reviewed_at=now() WHERE id=${arg} AND reviewed_at IS NULL`);
      const b = await tx.execute(sql`UPDATE events SET name='mobile_content_report_reviewed' WHERE id=${arg} AND name='mobile_content_report'`);
      return { reviewed: (a.rowCount ?? 0) + (b.rowCount ?? 0) };
    });
  }
  if (name === 'order' && /^[a-f0-9-]{36}$/.test(arg ?? '')) {
    return (await db.execute(sql`SELECT id,status,tier,amount_rub,created_at FROM yookassa_payments
      WHERE id=${arg} AND kind='subscription_mobile'`)).rows;
  }
  if (name === 'reconcile') {
    const stale = await db.execute(sql`SELECT id,yookassa_payment_id FROM yookassa_payments
      WHERE kind='subscription_mobile' AND status='pending' AND created_at < now()-interval '15 minutes'
      ORDER BY created_at LIMIT 50`);
    let checked = 0, missingProviderId = 0, failed = 0;
    for (const row of stale.rows) {
      if (!row.yookassa_payment_id) { missingProviderId++; continue; }
      try { await settleMobileMonth(String(row.id)); checked++; } catch { failed++; }
    }
    return { checked, missingProviderId, failed };
  }
  throw Error('Unknown sandbox operation');
}
