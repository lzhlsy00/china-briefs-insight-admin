import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { errorResponse, successResponse, optionsResponse } from '@/lib/api/response'
import { handleRouteError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

interface UserProfileRecord {
  id: string
  email: string | null
  subscription_status: string | null
  created_at: string | null
  subscribed: string | null
  latest_renewal: string | null
  transactions: number | null
  current_period_start: string | null
  current_period_end: string | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return errorResponse('User ID is required', { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        'id, email, subscription_status, created_at, subscribed, latest_renewal, transactions, current_period_start, current_period_end'
      )
      .eq('id', id)
      .maybeSingle<UserProfileRecord>()

    if (error) {
      console.error('Supabase fetch user_profiles error:', error)
      return errorResponse('Failed to fetch user profile', { status: 500 })
    }

    if (!data) {
      return errorResponse('User not found', { status: 404 })
    }

    const normalizedUser: UserProfileRecord = (() => {
      if (!data) {
        throw new Error('Invariant: expected profile data');
      }

      const now = Date.now();
      const periodEnd = data.current_period_end ? Date.parse(data.current_period_end) : null;
      const derived = periodEnd && !Number.isNaN(periodEnd) && periodEnd > now ? 'pro' : (data.subscription_status ?? 'free');

      return { ...data, subscription_status: derived };
    })();

    return successResponse({ user: normalizedUser })
  } catch (error) {
    return handleRouteError(error)
  }
}

export function OPTIONS() {
  return optionsResponse();
}
