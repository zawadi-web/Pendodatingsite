import { NextRequest } from 'next/server';

type RateLimitRecord = {
  count: number;
  resetTime: number;
};

const rateLimitMap = new Map<string, RateLimitRecord>();

// Clean up expired rate limit entries every 5 minutes to prevent memory leaks
if (typeof global !== 'undefined') {
  const globalAny = global as any;
  if (!globalAny.rateLimitCleanupInterval) {
    globalAny.rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of rateLimitMap.entries()) {
        if (now > record.resetTime) {
          rateLimitMap.delete(key);
        }
      }
    }, 5 * 60 * 1000);
    // Unref interval if possible so it doesn't block server environments/process exits
    if (globalAny.rateLimitCleanupInterval.unref) {
      globalAny.rateLimitCleanupInterval.unref();
    }
  }
}

/**
 * Checks if a given IP has exceeded the allowed limit within a window of time.
 * @param ip The IP address of the client
 * @param limit Max allowed requests within windowMs
 * @param windowMs The window duration in milliseconds
 */
export function rateLimit(
  ip: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record) {
    const newRecord = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(ip, newRecord);
    return { success: true, remaining: limit - 1, resetTime: newRecord.resetTime };
  }

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    return { success: true, remaining: limit - 1, resetTime: record.resetTime };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count += 1;
  return { success: true, remaining: limit - record.count, resetTime: record.resetTime };
}

/**
 * Extracts the client IP address from request headers.
 */
export function getClientIp(request: Request | NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}
