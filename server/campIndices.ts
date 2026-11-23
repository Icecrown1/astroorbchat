import type { Express } from 'express';
import { indexSource, readIndices } from '../shared/campIndices';

export function registerCampIndices(app: Express) {
  // The set of valid keys is bounded by the deck. Coalesce simultaneous lookups.
  const cache = new Map<string, { until: number, value: Promise<ReturnType<typeof readIndices>> }>();
  app.get('/api/camp/indices/:first/:second', async (req, res) => {
    let url: string;
    try { url = indexSource(Number(req.params.first), Number(req.params.second)); }
    catch { res.status(400).json({ok:false,error:'unsupported_card'}); return; }
    let hit = cache.get(url);
    if (!hit || hit.until < Date.now()) {
      const value = fetch(url, { redirect:'error', signal:AbortSignal.timeout(8000) })
        .then(async response => {
          if (!response.ok) throw new Error();
          return readIndices(await response.text());
        });
      hit = { until:Date.now()+86_400_000, value };
      cache.set(url, hit);
    }
    try { res.json({ok:true,data:await hit.value}); }
    catch { cache.delete(url); res.status(503).json({ok:false,error:'score_unavailable'}); }
  });
}
