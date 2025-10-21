import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { successResponse, errorResponse } from '@/lib/api/response';
import { handleRouteError } from '@/lib/api/error';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/v1/admin/users/[id]
 * 更新用户信息
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { subscription_status } = body;

    // 更新用户订阅状态
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        subscription_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return errorResponse('Failed to update user', { status: 500 });
    }

    return successResponse({ user: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

