import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const deriveSubscriptionStatus = (subscription: Stripe.Subscription) => {
  const status = subscription.status;
  if (status === 'canceled' || status === 'cancelled') {
    return 'canceled';
  }

  if (status === 'active' || status === 'trialing' || status === 'past_due') {
    return 'pro';
  }

  return 'free';
};



const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const stripeClient = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-08-27.basil' })
  : null

const toIso = (timestamp?: number | null) => {
  if (!timestamp) {
    return null
  }

  return new Date(timestamp * 1000).toISOString()
}

const sanitizeEmail = (email?: string | null) => {
  if (typeof email !== 'string') {
    return null
  }

  const trimmed = email.trim().toLowerCase()
  return trimmed || null
}

const resolveUserFromSubscription = async (subscription: Stripe.Subscription) => {
  const metadataUserId = typeof subscription.metadata?.user_id === 'string' ? subscription.metadata.user_id.trim() : '';
  let userId = metadataUserId;
  const metadataEmail = typeof subscription.metadata?.email === 'string' ? subscription.metadata.email : undefined;
  const portalEmail = typeof subscription.metadata?.portal_email === 'string' ? subscription.metadata.portal_email : undefined;
  let email = sanitizeEmail(metadataEmail) || sanitizeEmail(portalEmail);

  if (!email && typeof (subscription as Stripe.Subscription & { customer_email?: string }).customer_email === 'string') {
    email = sanitizeEmail((subscription as Stripe.Subscription & { customer_email?: string }).customer_email);
  }

  if (!userId && typeof subscription.customer === 'string' && stripeClient) {
    try {
      const customer = await stripeClient.customers.retrieve(subscription.customer);
      if (typeof customer !== 'string' && !('deleted' in customer)) {
        email = email || sanitizeEmail(customer.email) || sanitizeEmail(customer.metadata?.portal_email as string | undefined);
      }
    } catch (error) {
      console.error('Failed to retrieve customer for subscription', {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        error,
      });
    }
  }

  if (!userId && email) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle<{ id: string }>();

    if (error) {
      console.error('Supabase lookup by email failed', { email, error });
    }

    if (data) {
      userId = data.id;
    }
  }

  if (!userId) {
    return null;
  }

  return { userId, email } as { userId: string; email: string | null };
};

const resolveUserFromInvoice = async (invoice: Stripe.Invoice) => {
  let subscriptionData: Stripe.Subscription | null = null;
  if (typeof invoice.subscription === 'string' && stripeClient) {
    try {
      subscriptionData = await stripeClient.subscriptions.retrieve(invoice.subscription);
    } catch (error) {
      console.error('Failed to retrieve subscription for invoice', {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription,
        error,
      });
    }
  }

  const metadataUserId = typeof invoice.metadata?.user_id === 'string' ? invoice.metadata.user_id.trim() : '';
  let userId = metadataUserId;
  const invoiceMetadataEmail = typeof invoice.metadata?.email === 'string' ? invoice.metadata.email : undefined;
  const invoicePortalEmail = typeof invoice.metadata?.portal_email === 'string' ? invoice.metadata.portal_email : undefined;
  let email = sanitizeEmail(invoice.customer_email) || sanitizeEmail(invoiceMetadataEmail) || sanitizeEmail(invoicePortalEmail);

  if (!userId && subscriptionData) {
    const subscriptionUserId = typeof subscriptionData.metadata?.user_id === 'string' ? subscriptionData.metadata.user_id.trim() : '';
    if (subscriptionUserId) {
      userId = subscriptionUserId;
    }
  }

  if (!email && subscriptionData && typeof subscriptionData.customer === 'string' && stripeClient) {
    try {
      const customer = await stripeClient.customers.retrieve(subscriptionData.customer);
      if (typeof customer !== 'string' && !('deleted' in customer)) {
        email = sanitizeEmail(customer.email) || sanitizeEmail(customer.metadata?.portal_email as string | undefined);
      }
    } catch (error) {
      console.error('Failed to retrieve customer for subscription metadata', {
        invoiceId: invoice.id,
        subscriptionId: subscriptionData.id,
        error,
      });
    }
  }

  if (!email && typeof invoice.customer === 'string' && stripeClient) {
    try {
      const customer = await stripeClient.customers.retrieve(invoice.customer);
      if (typeof customer !== 'string' && !('deleted' in customer)) {
        email = sanitizeEmail(customer.email) || sanitizeEmail(customer.metadata?.portal_email as string | undefined);
      }
    } catch (error) {
      console.error('Failed to retrieve customer for invoice', {
        invoiceId: invoice.id,
        customerId: invoice.customer,
        error,
      });
    }
  }

  if (userId) {
    return { userId, email, subscription: subscriptionData };
  }

  if (email) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle<{ id: string }>();

    if (error) {
      console.error('Supabase lookup by email failed', { email, error });
    }

    if (data) {
      return { userId: data.id, email, subscription: subscriptionData };
    }
  }

  return null;
}

const handleInvoicePaymentSucceeded = async (invoice: Stripe.Invoice) => {
  const resolved = await resolveUserFromInvoice(invoice);
  if (!resolved) {
    console.error('Unable to resolve user for invoice payment', { invoiceId: invoice.id });
    return;
  }

  const { userId, subscription } = resolved;

  const { data: profile, error: fetchError } = await supabase
    .from('user_profiles')
    .select('subscribed, transactions, current_period_start, current_period_end')
    .eq('id', userId)
    .maybeSingle<{ subscribed: string | null; transactions: number | null; current_period_start: string | null; current_period_end: string | null }>();

  if (fetchError) {
    console.error('Supabase fetch user profile failed', { userId, error: fetchError });
    return;
  }

  if (!profile) {
    console.warn('User profile not found for invoice payment', { userId, invoiceId: invoice.id });
    return;
  }

  const paidAt = invoice.status_transitions?.paid_at ?? invoice.created ?? Math.floor(Date.now() / 1000);
  const paidIso = toIso(paidAt) ?? new Date().toISOString();

  const quantity = invoice.lines?.data?.reduce((sum, line) => sum + (line.quantity ?? 0), 0) ?? 0;
  const normalizedQuantity = quantity > 0 ? quantity : 1;
  const intervalMs = normalizedQuantity * 30 * 24 * 60 * 60 * 1000;

  const existingStart = profile.current_period_start ? new Date(profile.current_period_start) : null;
  const existingEnd = profile.current_period_end ? new Date(profile.current_period_end) : null;
  const subscriptionPeriodStart = subscription?.current_period_start ? new Date(subscription.current_period_start * 1000) : null;
  const linePeriodStart = invoice.lines?.data?.[0]?.period?.start ? new Date((invoice.lines?.data?.[0]?.period?.start ?? 0) * 1000) : null;
  const nowDate = new Date();

  let periodStartDate: Date;
  let periodEndDate: Date;

  if (existingEnd && existingEnd.getTime() > nowDate.getTime()) {
    periodStartDate = existingStart ?? nowDate;
    const baseEnd = new Date(Math.max(existingEnd.getTime(), nowDate.getTime()));
    periodEndDate = new Date(baseEnd.getTime() + intervalMs);
  } else {
    periodStartDate = subscriptionPeriodStart ?? linePeriodStart ?? nowDate;
    if (periodStartDate.getTime() < nowDate.getTime()) {
      periodStartDate = nowDate;
    }
    periodEndDate = new Date(periodStartDate.getTime() + intervalMs);
  }

  const updatedTransactions = (profile.transactions ?? 0) + normalizedQuantity;

  const updates: Record<string, unknown> = {
    latest_renewal: paidIso,
    subscription_status: 'pro',
    current_period_start: periodStartDate.toISOString(),
    current_period_end: periodEndDate.toISOString(),
    transactions: updatedTransactions,
    updated_at: new Date().toISOString(),
  };

  if (!profile.subscribed) {
    updates.subscribed = paidIso;
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId);

  if (updateError) {
    console.error('Supabase update user profile failed', { userId, updates, error: updateError });
  }
}


const handleSubscriptionUpdated = async (subscription: Stripe.Subscription) => {
  const resolved = await resolveUserFromSubscription(subscription);
  if (!resolved) {
    console.warn('Unable to resolve user for subscription update', { subscriptionId: subscription.id });
    return;
  }

  const { userId } = resolved;
  const derivedStatus = deriveSubscriptionStatus(subscription);
  const updates: Record<string, unknown> = {
    subscription_status: derivedStatus,
    updated_at: new Date().toISOString(),
  };

  const periodStart = toIso(subscription.current_period_start);
  const periodEnd = toIso(subscription.current_period_end);

  if (periodStart) {
    updates.current_period_start = periodStart;
  }

  if (periodEnd) {
    updates.current_period_end = periodEnd;
  }

  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('Failed to update profile on subscription update', { userId, subscriptionId: subscription.id, error });
  }
}

const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  const resolved = await resolveUserFromSubscription(subscription);
  if (!resolved) {
    console.warn('Unable to resolve user for subscription deletion', { subscriptionId: subscription.id });
    return;
  }

  const { userId } = resolved;
  const endedIso = toIso(subscription.ended_at) ?? new Date().toISOString();

  const updates: Record<string, unknown> = {
    subscription_status: 'canceled',
    updated_at: new Date().toISOString(),
  };

  const periodEnd = toIso(subscription.current_period_end);
  if (periodEnd) {
    updates.current_period_end = periodEnd;
  }

  const periodStart = toIso(subscription.current_period_start);
  if (periodStart) {
    updates.current_period_start = periodStart;
  }

  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('Failed to update profile on subscription deletion', { userId, subscriptionId: subscription.id, error });
  }
}

export async function POST(request: Request) {
  if (!stripeClient || !webhookSecret) {
    console.error('Missing Stripe configuration for webhook handling')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe signature header' }, { status: 400 })
  }

  const payload = await request.text()

  let event: Stripe.Event
  try {
    event = stripeClient.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    console.error('Stripe signature verification failed', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'checkout.session.completed':
        console.info('Stripe checkout session completed', {
          eventId: event.id,
          type: event.type,
        })
        break
      default:
        console.info('Unhandled Stripe event type', event.type)
    }
  } catch (error) {
    console.error('Error handling Stripe webhook event', { eventId: event.id, type: event.type, error })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
