import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory rate limiting map. Key: IP + endpoint, Value: array of timestamps
const rateLimitMap = new Map<string, number[]>();

const SENSITIVE_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/mpesa/stkpush',
  '/api/upload',
];

// Renamed from `middleware` → `proxy` as required by Next.js 16+
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // 1. Add Security Headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Content Security Policy — covers all endpoints needed by Google Identity Services SDK
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com",
      "img-src 'self' data: blob: https: https://*.googleusercontent.com",
      "font-src 'self' data:",
      "connect-src 'self' https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com",
      "frame-src 'self' https://accounts.google.com",
    ].join('; ')
  );

  // 2. Enforce Basic Rate Limiting on Sensitive Routes
  if (SENSITIVE_ROUTES.some((route) => pathname.startsWith(route))) {
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const key = `${ip}:${pathname}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute sliding window
    const limit = 20; // Maximum 20 requests per minute

    let timestamps = rateLimitMap.get(key) || [];
    timestamps = timestamps.filter((t) => now - t < windowMs);

    if (timestamps.length >= limit) {
      console.warn(`Rate limit exceeded for IP: ${ip} on route: ${pathname}`);
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again in 1 minute.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
    }

    timestamps.push(now);
    rateLimitMap.set(key, timestamps);
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
