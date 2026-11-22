import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Express } from 'express';
import { aiQuestions, subscriptions, tarotReadings, users } from '@shared/schema';
import { db } from './db';
import { generateToken } from './lib/jwt';
import { sql } from 'drizzle-orm';
import { getTarotCard, TAROT_SPREADS } from '@shared/tarot';

// Only registered in the marked internal database. Each reviewer gets a
// private profile so that reviewers never share questions or profile edits.
export async function registerMobileReview(app: Express) {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS android_review_access (
    slot text PRIMARY KEY CHECK (slot = 'review'), digest char(64) NOT NULL)`);
  const stored = await db.execute(sql`SELECT digest FROM android_review_access WHERE slot='review'`);
  const hash = process.env.ANDROID_REVIEW_CODE_SHA256 || String(stored.rows[0]?.digest || '');
  if (!hash) return;
  if (!/^[0-9a-f]{64}$/.test(hash)) throw Error('Invalid Android review credential digest');
  const expected = Buffer.from(hash, 'hex');
  app.post('/api/mobile/auth/exchange', async (req, res, next) => {
    const code = req.body?.code;
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(code)) return next();
    if (!timingSafeEqual(createHash('sha256').update(code).digest(), expected)) return next();
    res.set('Cache-Control', 'no-store');
    try {
      const id = await db.transaction(async tx => {
        const started = new Date();
        const end = new Date(started.getTime() + 30 * 86400000);
        const [user] = await tx.insert(users).values({
          tgId: 'play-review-' + randomBytes(16).toString('hex'), name: 'Демо AstroOrbi',
          gender: 'other', age: 30, birthdayDate: new Date('1996-01-01T12:00:00Z'),
          birthTime: '12:00', birthPlace: 'Москва', referralCode: randomBytes(9).toString('hex'),
          subscriptionOrbs: '550', orbsResetAt: end, pushEnabled: false,
        }).returning({ id: users.id });
        await tx.insert(subscriptions).values({
          userId: user.id, tier: 'premium', status: 'active', startedAt: started,
          currentPeriodEnd: end, autoRenew: false,
        });
        await tx.insert(tarotReadings).values({
          userId: user.id, spread: 'daily', day: '2026-01-01', locale: 'ru',
          cards: [{ cardId: 'fool', position: 0, reversed: false }],
          interpretation: { intro: 'Пример сохранённого расклада.', cards: [{ title: 'Шут', text: 'Карта начала пути.' }] },
        });
        await tx.insert(aiQuestions).values({
          userId: user.id, question: 'С чего начать знакомство с картой дня?',
          answer: 'Демонстрационный пример. Рассмотрите карту и выберите одну деталь, которая привлекла внимание.',
        });
        const cards = ['fool','magician','empress','emperor','lovers','chariot','strength','hermit','justice','world']
          .map((cardId, position) => ({ cardId, position, reversed: position === 1 }));
        await tx.insert(tarotReadings).values({
          userId: user.id, spread:'celtic', day:'2026-01-02', locale:'ru', cards,
          interpretation:{ intro:'Демонстрационный Кельтский крест.',
            cards:cards.map((card, i) => ({ title:TAROT_SPREADS.celtic.positions[i][0], text:getTarotCard(card.cardId)!.kw[card.reversed ? 1 : 0] })),
            synthesis:'От первого шага к завершению: посмотрите, как меняются темы десяти позиций.' },
        });
        return user.id;
      });
      res.json({ ok: true, data: { token: generateToken(id, 8 * 3600, 'mobile') } });
    } catch {
      res.status(503).json({ ok: false, error: 'mobile_login_unavailable' });
    }
  });
}
