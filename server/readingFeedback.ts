import type { Express } from "express";
import { pool } from "./db";
import { requireAuth } from "./middleware/auth";

const topics = new Set(["matrix", "tarot", "natal"]);

export async function registerReadingFeedback(app: Express) {
  await pool.query(`CREATE TABLE IF NOT EXISTS reading_feedback (
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic text NOT NULL, score smallint NOT NULL CHECK(score BETWEEN 1 AND 5),
    PRIMARY KEY(user_id,topic));
    CREATE TABLE IF NOT EXISTS reading_feedback_bonus (
    user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS reading_feedback_campaign (
    id integer PRIMARY KEY CHECK(id=1), awarded integer NOT NULL CHECK(awarded BETWEEN 0 AND 100));
    INSERT INTO reading_feedback_campaign VALUES (1,0) ON CONFLICT DO NOTHING`);
  app.post("/api/reading-feedback", requireAuth, async (req, res, next) => {
    const userId = (req as typeof req & { userId: string }).userId;
    const { topic, score } = req.body;
    if (
      !topics.has(topic) ||
      !Number.isInteger(score) ||
      score < 1 ||
      score > 5
    ) {
      res.status(400).json({ ok: false, error: "invalid_vote" });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO reading_feedback VALUES($1,$2,$3) ON CONFLICT (user_id,topic) DO UPDATE SET score=EXCLUDED.score",
        [userId, topic, score],
      );
      const {
        rows: [campaign],
      } = await client.query(
        "SELECT awarded FROM reading_feedback_campaign WHERE id=1 FOR UPDATE",
      );
      let rewarded = false;
      if (campaign.awarded < 100) {
        const claim = await client.query(
          "INSERT INTO reading_feedback_bonus VALUES($1) ON CONFLICT DO NOTHING RETURNING user_id",
          [userId],
        );
        if (claim.rowCount) {
          await client.query(
            "UPDATE users SET referral_orbs=referral_orbs+20 WHERE id=$1",
            [userId],
          );
          await client.query(
            "UPDATE reading_feedback_campaign SET awarded=awarded+1 WHERE id=1",
          );
          rewarded = true;
        }
      }
      const { rows } = await client.query(
        "SELECT score,count(*)::int AS votes FROM reading_feedback WHERE topic=$1 AND user_id<>$2 GROUP BY score ORDER BY score",
        [topic, userId],
      );
      await client.query("COMMIT");
      res.json({ ok: true, data: { rewarded, others: rows } });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  });
}
