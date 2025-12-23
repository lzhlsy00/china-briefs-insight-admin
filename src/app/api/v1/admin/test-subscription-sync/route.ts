import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api/response';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeClient = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-09-30.clover' })
  : null;

export const POST = async (request: NextRequest) => {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return errorResponse('请提供用户邮箱');
    }

    // 1. 检查环境变量
    const envCheck = {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    };

    console.log('环境变量检查:', envCheck);

    if (!stripeClient) {
      return successResponse({
        error: 'Stripe 未配置',
        envCheck
      });
    }

    // 2. 测试 Supabase 连接
    console.log('测试 Supabase 连接...');
    const { data: testData, error: testError } = await supabase
      .from('user_profiles')
      .select('id, email, subscription_status')
      .eq('email', email)
      .single();

    if (testError) {
      console.error('Supabase 查询错误:', testError);
      return successResponse({
        error: 'Supabase 查询失败',
        supabaseError: testError.message,
        envCheck
      });
    }

    if (!testData) {
      return successResponse({
        error: '用户不存在',
        email,
        envCheck
      });
    }

    console.log('找到用户:', testData);

    // 3. 查询 Stripe 订阅
    console.log('查询 Stripe 客户...');
    const customers = await stripeClient.customers.list({ 
      email, 
      limit: 1 
    });

    if (customers.data.length === 0) {
      console.log('Stripe 中没有找到客户');
      
      // 尝试更新为 free
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          subscription_status: 'free',
          updated_at: new Date().toISOString()
        })
        .eq('id', testData.id);

      return successResponse({
        message: 'Stripe 中没有客户，尝试更新为 free',
        updateSuccess: !updateError,
        updateError: updateError?.message,
        userProfile: testData,
        envCheck
      });
    }

    const customerId = customers.data[0].id;
    console.log('找到 Stripe 客户:', customerId);

    // 4. 获取订阅信息
    const subscriptions = await stripeClient.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });

    console.log(`找到 ${subscriptions.data.length} 个订阅`);

    // 5. 尝试更新数据库
    const activeSubscription = subscriptions.data.find(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    );

    const newStatus = activeSubscription ? 'pro' : 'free';
    
    console.log('尝试更新订阅状态为:', newStatus);
    
    const { data: updateData, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        subscription_status: newStatus,
        updated_at: new Date().toISOString(),
        // 添加测试标记
        test_updated_at: new Date().toISOString()
      })
      .eq('id', testData.id)
      .select();

    console.log('更新结果:', { data: updateData, error: updateError });

    // 6. 重新查询验证
    const { data: verifyData, error: verifyError } = await supabase
      .from('user_profiles')
      .select('id, email, subscription_status, updated_at, test_updated_at')
      .eq('id', testData.id)
      .single();

    return successResponse({
      envCheck,
      userBefore: testData,
      userAfter: verifyData,
      updateResult: {
        success: !updateError,
        error: updateError?.message,
        data: updateData
      },
      stripeInfo: {
        customerId,
        subscriptions: subscriptions.data.map(sub => ({
          id: sub.id,
          status: sub.status,
          created: new Date(sub.created * 1000).toISOString(),
          trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
          trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        }))
      },
      shouldBeStatus: newStatus
    });

  } catch (error) {
    console.error('测试错误:', error);
    return errorResponse('测试失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
};