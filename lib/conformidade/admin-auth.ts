import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'vd_admin_session';

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'dev-insecure-secret';
}

export function createAdminToken(): string {
  const exp = Date.now() + 1000 * 60 * 60 * 12; // 12h
  const payload = `admin:${exp}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [payload, sig] = decoded.split('.');
    if (!payload || !sig) return false;
    const expected = createHmac('sha256', secret()).update(payload).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const exp = Number(payload.split(':')[1]);
    return Number.isFinite(exp) && Date.now() < exp;
  } catch {
    return false;
  }
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export { COOKIE_NAME };
