import { NextResponse } from 'next/server';

const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const DEFAULT_ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With';
const MAX_AGE = '86400';

const normalizeOrigin = (origin?: string | null): string | null => {
  if (!origin) return null;
  return origin.replace(/\/+$/, '').trim().toLowerCase();
};

type MaybeRequest = Request | undefined;

const parseAllowedOrigins = (): string[] => {
  const value = process.env.CORS_ALLOWED_ORIGINS;
  if (!value) {
    return ['*'];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const resolveAllowedOrigin = (request: MaybeRequest, allowedOrigins: string[]): string => {
  if (allowedOrigins.includes('*')) {
    return '*';
  }

  const requestOrigin = request?.headers.get('origin');
  const normalizedRequest = normalizeOrigin(requestOrigin);

  if (normalizedRequest) {
    const matchedOrigin = allowedOrigins.find((origin) => normalizeOrigin(origin) === normalizedRequest);
    if (matchedOrigin) {
      return matchedOrigin;
    }
  }

  return allowedOrigins[0] ?? '*';
};

const resolveAllowedHeaders = (request: MaybeRequest): string => {
  return request?.headers.get('access-control-request-headers') ?? DEFAULT_ALLOWED_HEADERS;
};

export const applyCorsHeaders = <T extends NextResponse>(response: T, request?: MaybeRequest): T => {
  const allowedOrigins = parseAllowedOrigins();
  const origin = resolveAllowedOrigin(request, allowedOrigins);
  const headers = resolveAllowedHeaders(request);

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  response.headers.set('Access-Control-Allow-Headers', headers);
  response.headers.set('Access-Control-Max-Age', MAX_AGE);

  if (origin !== '*') {
    response.headers.append('Vary', 'Origin');
  }

  return response;
};

export const createCorsPreflightResponse = (request: Request) => {
  const response = new NextResponse(null, { status: 204 });
  return applyCorsHeaders(response, request);
};
