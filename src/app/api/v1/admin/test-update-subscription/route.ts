import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api/response';

export const POST = async (request: NextRequest) => {
  try {
    const { email, status = 'pro' } = await request.json();
    
    if (!email) {
      return errorResponse('请提供用户邮箱');
    }

    // 1. 查询用户
    console.log('查询用户:', email);
    const { data: user, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, email, subscription_status')
      .eq('email', email)
      .single();

    if (fetchError) {
      console.error('查询错误:', fetchError);
      return errorResponse('查询用户失败: ' + fetchError.message);
    }

    if (!user) {
      return errorResponse('用户不存在');
    }

    console.log('找到用户:', user);

    // 2. 尝试简单更新
    const simpleUpdate = {
      subscription_status: status
    };

    console.log('尝试更新:', simpleUpdate);

    const { data: result1, error: error1 } = await supabase
      .from('user_profiles')
      .update(simpleUpdate)
      .eq('id', user.id)
      .select('id, email, subscription_status');

    console.log('简单更新结果:', { data: result1, error: error1 });

    // 3. 尝试带时间戳的更新
    const updateWithTime = {
      subscription_status: status,
      updated_at: new Date().toISOString()
    };

    console.log('尝试带时间戳更新:', updateWithTime);

    const { data: result2, error: error2 } = await supabase
      .from('user_profiles')
      .update(updateWithTime)
      .eq('id', user.id)
      .select();

    console.log('带时间戳更新结果:', { data: result2, error: error2 });

    // 4. 验证最终状态
    const { data: finalUser, error: finalError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // 5. 直接使用 RPC 函数测试（如果上面都失败）
    let rpcResult = null;
    if (!result1 && !result2) {
      console.log('尝试使用 RPC 更新...');
      const { data: rpc, error: rpcError } = await supabase
        .rpc('update_user_subscription_status', {
          user_id: user.id,
          new_status: status
        });
      rpcResult = { data: rpc, error: rpcError };
      console.log('RPC 结果:', rpcResult);
    }

    return successResponse({
      userBefore: user,
      simpleUpdate: {
        attempted: simpleUpdate,
        result: result1,
        error: error1?.message
      },
      updateWithTime: {
        attempted: updateWithTime,
        result: result2,
        error: error2?.message
      },
      userAfter: finalUser,
      finalError: finalError?.message,
      rpcResult,
      debug: {
        supabaseUrl: process.env.SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
        keyPrefix: process.env.SUPABASE_SERVICE_KEY?.substring(0, 20) + '...'
      }
    });

  } catch (error) {
    console.error('测试错误:', error);
    return errorResponse('测试失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
};