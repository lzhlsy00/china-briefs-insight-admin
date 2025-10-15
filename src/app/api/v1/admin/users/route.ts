import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { successResponse, errorResponse } from '@/lib/api/response';
import { handleRouteError } from '@/lib/api/error';

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
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return errorResponse('Failed to fetch user count', { status: 500 });
    }

    // 获取用户列表
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, subscription_status, subscription_end, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return errorResponse('Failed to fetch users', { status: 500 });
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return successResponse({
      users: users || [],
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

