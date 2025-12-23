import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api/response';
import { syncUserSubscriptionStatus } from '@/lib/stripe/syncSubscriptionStatus';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const POST = async (_request: NextRequest, context: RouteContext) => {
  try {
    const { id: userId } = await context.params;

    // 1. 获取用户信息
    const { data: user, error: userError } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.email) {
      return errorResponse('用户不存在或没有邮箱');
    }

    // 2. 同步订阅状态
    const result = await syncUserSubscriptionStatus(user.email);

    if (!result.success) {
      return errorResponse(result.message, { 
        error: result.error 
      });
    }

    return successResponse({
      message: result.message,
      oldStatus: result.oldStatus,
      newStatus: result.newStatus
    });

  } catch (error) {
    console.error('同步订阅状态失败:', error);
    return errorResponse('同步失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
};