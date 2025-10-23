import { NextRequest } from 'next/server';
import Stripe from 'stripe';

import { supabase } from '@/lib/supabase';
import { errorResponse, successResponse, optionsResponse } from '@/lib/api/response';
import { handleRouteError } from '@/lib/api/error';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('[subscription/cancel] Missing STRIPE_SECRET_KEY environment variable');
}

const stripeClient = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-09-30.clover' })
  : null;

const toIso = (timestamp?: number | null) => {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
};

const derivePeriodBoundary = (
  items: Stripe.SubscriptionItem[] | undefined,
  boundary: 'current_period_start' | 'current_period_end',
) => {
  if (!items?.length) {
    return null;
  }

  let boundaryValue: number | null = null;

  for (const item of items) {
    const value = item[boundary];

    if (typeof value !== 'number') {
      continue;
    }

    if (boundaryValue === null) {
      boundaryValue = value;
      continue;
    }

    boundaryValue =
      boundary === 'current_period_end'
        ? Math.max(boundaryValue, value)
        : Math.min(boundaryValue, value);
  }

  return toIso(boundaryValue);
};

export async function POST(request: NextRequest) {
  try {
    if (!stripeClient) {
      return errorResponse('Stripe configuration missing', { status: 500 });
    }

    const body = await request.json().catch(() => null) as { userId?: unknown } | null;

    if (!body || typeof body !== 'object' || typeof body.userId !== 'string' || !body.userId.trim()) {
      return errorResponse('User ID is required', { status: 400 });
    }

    const userId = body.userId.trim();

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('email, subscription_status')
      .eq('id', userId)
      .maybeSingle<{ email: string | null; subscription_status: string | null }>();

    if (profileError) {
      console.error('[subscription/cancel] Failed to load profile', { userId, error: profileError });
      return errorResponse('Failed to load user profile', { status: 500 });
    }

    if (!profile || !profile.email) {
      return errorResponse('User email not found', { status: 404 });
    }

    const customers = await stripeClient.customers.list({ email: profile.email, limit: 5 });

    if (!customers.data.length) {
      return errorResponse('Stripe customer not found for this email', { status: 404 });
    }

    const customer = customers.data[0];

    const subscriptions = await stripeClient.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10,
    });

    const activeSubscription = subscriptions.data.find((subscription) =>
      ['active', 'trialing', 'past_due'].includes(subscription.status),
    );

    if (!activeSubscription) {
      return errorResponse('No active subscription to cancel', { status: 400 });
    }

    const cancelled = await stripeClient.subscriptions.cancel(activeSubscription.id);

    const updates: Record<string, unknown> = {
      subscription_status: 'canceled',
      updated_at: new Date().toISOString(),
    };

    const subscriptionItems = cancelled.items?.data;

    const periodEnd = derivePeriodBoundary(subscriptionItems, 'current_period_end');
    if (periodEnd) {
      updates.current_period_end = periodEnd;
    }

    const periodStart = derivePeriodBoundary(subscriptionItems, 'current_period_start');
    if (periodStart) {
      updates.current_period_start = periodStart;
    }

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId);

    if (updateError) {
      console.error('[subscription/cancel] Failed to update profile after cancellation', {
        userId,
        error: updateError,
      });
    }

    return successResponse({
      canceled: true,
      subscriptionId: cancelled.id,
      status: cancelled.status,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
