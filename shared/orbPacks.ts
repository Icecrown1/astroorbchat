/**
 * Единый прайс паков звёзд (орбов) — ОДИН источник правды для всех способов оплаты:
 * Telegram Stars, банковская карта (ЮKassa, ₽) и TON (по курсу от USD).
 *
 * Логика цены: базовый объём = число ⭐ (1⭐ ≈ 1 орб), плюс бонус за объём.
 * Подписка Standard (199 ₽ → 250 орбов) остаётся выгоднее пополнения — так и задумано:
 * пополнение — «добить» месяц, подписка — основной продукт.
 */
export interface OrbPack {
  id: 's50' | 's100' | 's250';
  /** Сколько звёзд зачислится на баланс (с бонусом) */
  orbs: number;
  /** Базовый объём без бонуса — для подписи «+N бонус» */
  base: number;
  /** Цена в Telegram Stars (XTR) */
  stars: number;
  /** Цена в USD — база для TON */
  usd: number;
  /** Цена в рублях для карты (ЮKassa) */
  rub: number;
  /** Подсветить как самый популярный */
  hot?: boolean;
}

export const ORB_PACKS: readonly OrbPack[] = [
  { id: 's50',  orbs: 65,  base: 50,  stars: 50,  usd: 0.99, rub: 89 },
  { id: 's100', orbs: 140, base: 100, stars: 100, usd: 1.99, rub: 169, hot: true },
  { id: 's250', orbs: 375, base: 250, stars: 250, usd: 4.99, rub: 399 },
] as const;

export const ORB_PACK_IDS = ORB_PACKS.map((p) => p.id) as OrbPack['id'][];

export function getOrbPack(id: string | undefined | null): OrbPack | undefined {
  return ORB_PACKS.find((p) => p.id === id);
}

/** Найти пак по количеству зачисляемых орбов (для легаси-полей energyAmount) */
export function getOrbPackByOrbs(orbs: number | undefined | null): OrbPack | undefined {
  return ORB_PACKS.find((p) => p.orbs === orbs);
}
