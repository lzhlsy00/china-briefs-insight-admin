import { NextResponse } from 'next/server';

type ValidationError = {
  field: string;
  message: string;
};

type SuccessBody<T> = {
  success: true;
  data: T;
  message?: string;
};

type ErrorBody = {
  success: false;
  message: string;
  errors?: ValidationError[];
};

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

const withCors = (init?: ResponseInit) => {
  const headers = new Headers(init?.headers ?? {});

  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return {
    ...init,
    headers,
  } as ResponseInit;
};

export const optionsResponse = () => new NextResponse(null, withCors({ status: 204 }));

export const successResponse = <T>(data: T, init?: ResponseInit & { message?: string }) => {
  const { message, ...responseInit } = init ?? {};
  const body: SuccessBody<T> = {
    success: true,
    data,
    ...(message ? { message } : {}),
  };

  return NextResponse.json(body, withCors(responseInit));
};

export const successMessage = (message: string, init?: ResponseInit) => {
  return NextResponse.json({ success: true, message }, withCors(init));
};

export const errorResponse = (message: string, options?: { status?: number; errors?: ValidationError[] }) => {
  const { status = 500, errors } = options ?? {};
  const body: ErrorBody = {
    success: false,
    message,
    ...(errors?.length ? { errors } : {}),
  };

  return NextResponse.json(body, withCors({ status }));
};
