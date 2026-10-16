import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';

/** Constant-time bearer check for cron routes (avoids timing oracle on !==). */
export function isValidCronAuth(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authHeader) {
    return false;
  }
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}
