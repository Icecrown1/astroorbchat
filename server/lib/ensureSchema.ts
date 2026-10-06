/**
 * Самопроверка схемы БД при старте сервера.
 *
 * Зачем: у Replit теперь раздельные базы — development (воркспейс) и production
 * (опубликованное приложение). `npm run db:push` в Shell меняет ТОЛЬКО dev-базу,
 * и прод-база отстаёт от shared/schema.ts. Drizzle перечисляет все колонки
 * схемы в каждом SELECT, поэтому одна недостающая колонка (users.last_push_theme)
 * роняет любой запрос к users: логин, /api/user/me, статистику.
 *
 * Что делает:
 *  1) недостающие NULLABLE-колонки без default добавляет сама
 *     (ALTER TABLE … ADD COLUMN IF NOT EXISTS — неразрушающая операция);
 *  2) всё остальное (таблицы, NOT NULL-колонки) только пишет в лог —
 *     такие изменения нужно применять осознанно.
 * Результат последней проверки отдаётся в GET /api/health/schema.
 */
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "@shared/schema";
import { pool } from "../db";

export interface SchemaReport {
  checkedAt: string;
  added: string[];
  missing: string[];
  error?: string;
}

let lastReport: SchemaReport | null = null;
export const getSchemaReport = () => lastReport;

export async function ensureSchema(): Promise<SchemaReport> {
  const report: SchemaReport = { checkedAt: new Date().toISOString(), added: [], missing: [] };
  try {
    const { rows } = await pool.query(
      "select table_name, column_name from information_schema.columns where table_schema = 'public'",
    );
    const have = new Set(rows.map((r: any) => `${r.table_name}.${r.column_name}`));
    const tables = new Set(rows.map((r: any) => r.table_name));

    for (const value of Object.values(schema)) {
      if (!is(value, PgTable)) continue;
      const cfg = getTableConfig(value as PgTable);
      if (!tables.has(cfg.name)) {
        report.missing.push(`${cfg.name} (таблица)`);
        continue;
      }
      for (const col of cfg.columns) {
        const key = `${cfg.name}.${col.name}`;
        if (have.has(key)) continue;
        const safeToAdd = !col.notNull && !col.hasDefault && !col.primary;
        if (!safeToAdd) {
          report.missing.push(key);
          continue;
        }
        try {
          await pool.query(`ALTER TABLE "${cfg.name}" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.getSQLType()}`);
          report.added.push(key);
        } catch (e: any) {
          report.missing.push(`${key} (${e?.message || "ошибка"})`);
        }
      }
    }

    if (report.added.length) console.log("[SCHEMA] Добавлены колонки:", report.added.join(", "));
    if (report.missing.length) console.error("[SCHEMA] В БД не хватает:", report.missing.join(", "));
    if (!report.added.length && !report.missing.length) console.log("[SCHEMA] ✓ БД совпадает со схемой");
  } catch (e: any) {
    report.error = e?.message || String(e);
    console.error("[SCHEMA] Проверка не удалась:", report.error);
  }
  lastReport = report;
  return report;
}
