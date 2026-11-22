import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';

type Session = { userId: string; channel?: 'mobile' };

export function generateToken(userId: string, expiresInSeconds = 30 * 24 * 60 * 60, channel?: Session['channel']): string {
  return jwt.sign({ userId, channel }, JWT_SECRET, { expiresIn: expiresInSeconds });
}

export function verifyToken(token: string): Session | null {
  try {
    return jwt.verify(token, JWT_SECRET) as Session;
  } catch {
    return null;
  }
}
