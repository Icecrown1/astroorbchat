import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { storage } from '../storage';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }

  const user = await storage.getUser(payload.userId);

  if (!user) {
    return res.status(401).json({ ok: false, error: 'User not found' });
  }

  (req as any).user = user;
  (req as any).userId = user.id;

  next();
}
