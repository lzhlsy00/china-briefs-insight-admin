import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { successResponse, errorResponse } from '@/lib/api/response';
import { handleRouteError } from '@/lib/api/error';

type RawUserProfile = {
  id: string;
  email: string;
  full_name?: string | null;
  subscription_status?: string | null;
  created_at?: string | null;
  subscribed?: string | null;
  latest_renewal?: string | null;
  transactions?: number | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
};

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/users
 * 获取用户列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // 获取总数
    const { count, error: countError } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      console.error('Supabase count error (user_profiles):', countError)
      return errorResponse('Failed to fetch user count', { status: 500 });
    }

    // 获取用户列表
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase fetch users error:', error)
      return errorResponse('Failed to fetch users', { status: 500 });
    }

    const rawUsers = (users ?? []) as RawUserProfile[]
    const normalizedUsers = rawUsers.map((user) => ({
      id: user.id,
      email: user.email,
      subscription_status: user.subscription_status ?? 'unknown',
      created_at: user.created_at ?? null,
      subscribed: user.subscribed ?? null,
      latest_renewal: user.latest_renewal ?? null,
      transactions: user.transactions ?? 0,
      current_period_start: user.current_period_start ?? null,
      current_period_end: user.current_period_end ?? null,
    }));

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return successResponse({
      users: normalizedUsers,
      pagination: {
        current: page,
        totalCount,
        totalPages,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
