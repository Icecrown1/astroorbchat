// Тик рассылки «Карта дня» для Scheduled Deployment (Autoscale-прод спит без трафика).
// Запуск: npx tsx server/scripts/pushTick.ts
// Нужные секреты: DATABASE_URL (прод-база!), TELEGRAM_BOT_TOKEN.
import { storage } from '../storage';
import { runDailyPushTick } from '../lib/reengagement';

async function main() {
  if (!process.env.DATABASE_URL || !process.env.TELEGRAM_BOT_TOKEN) {
    console.error('[PUSH TICK] DATABASE_URL и TELEGRAM_BOT_TOKEN обязательны');
    process.exit(1);
  }
  console.log('[PUSH TICK] start', new Date().toISOString());
  await runDailyPushTick(storage);
  console.log('[PUSH TICK] done');
  process.exit(0);
}

main().catch((e) => { console.error('[PUSH TICK] fatal:', e); process.exit(1); });
