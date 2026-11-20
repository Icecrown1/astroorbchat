import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';

export function generateToken(userId: string, expiresInSeconds = 30 * 24 * 60 * 60): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: expiresInSeconds });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}
