import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api/response';
import { handleRouteError } from '@/lib/api/error';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeClient = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-09-30.clover' })
  : null;

const deriveSubscriptionStatus = (subscription: Stripe.Subscription) => {
  const status = subscription.status;
  if (status === 'canceled' || (status as string) === 'cancelled') {
    return 'canceled';
  }
  if (status === 'active' || status === 'trialing' || status === 'past_due') {
    return 'pro';
  }
  return 'free';
};

const toIso = (timestamp?: number | null) => {
  if (!timestamp) {
    return null;
  }
  return new Date(timestamp * 1000).toISOString();
};

export const POST = async (request: NextRequest) => {
  try {
    if (!stripeClient) {
      return errorResponse('Stripe 未配置');
    }

    const { email, userId } = await request.json();

    if (!email && !userId) {
      return errorResponse('请提供 email 或 userId');
    }

    console.log('开始同步订阅状态:', { email, userId });

    // 1. 查找用户
    let userProfile;
    if (userId) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error || !data) {
        return errorResponse('用户不存在');
      }
      userProfile = data;
    } else {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error || !data) {
        return errorResponse('用户不存在');
      }
      userProfile = data;
    }

    const userEmail = userProfile.email;
    const profileUserId = userProfile.id;

    console.log('找到用户:', { id: profileUserId, email: userEmail });

    // 2. 查找 Stripe 客户
    const customers = await stripeClient.customers.list({ 
      email: userEmail, 
      limit: 1 
    });

    if (customers.data.length === 0) {
      console.log('没有找到 Stripe 客户，更新为 free 状态');
      
      await supabase
        .from('user_profiles')
        .update({
          subscription_status: 'free',
          current_period_start: null,
          current_period_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileUserId);

      return successResponse({
        message: '用户没有 Stripe 订阅，已更新为 free 状态',
        userId: profileUserId,
        status: 'free'
      });
    }

    const customerId = customers.data[0].id;
    console.log('找到 Stripe 客户:', customerId);

    // 3. 获取所有订阅
    const subscriptions = await stripeClient.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });

    console.log(`找到 ${subscriptions.data.length} 个订阅`);

    // 4. 找到活跃的订阅
    const activeSubscription = subscriptions.data.find((sub) => {
      return sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';
    });

    let updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (activeSubscription) {
      const derivedStatus = deriveSubscriptionStatus(activeSubscription);
      const extendedSubscription = activeSubscription as Stripe.Subscription & { 
        current_period_start?: number; 
        current_period_end?: number;
        trial_start?: number;
        trial_end?: number;
      };

      updates.subscription_status = derivedStatus;
      
      // 处理试用期
      if (activeSubscription.status === 'trialing') {
        updates.subscription_status = 'pro'; // 试用期也视为 pro
        if (extendedSubscription.trial_start) {
          updates.current_period_start = toIso(extendedSubscription.trial_start);
        }
        if (extendedSubscription.trial_end) {
          updates.current_period_end = toIso(extendedSubscription.trial_end);
        }
        console.log('订阅处于试用期:', {
          trialStart: updates.current_period_start,
          trialEnd: updates.current_period_end
        });
      } else {
        // 正常订阅期
        if (extendedSubscription.current_period_start) {
          updates.current_period_start = toIso(extendedSubscription.current_period_start);
        }
        if (extendedSubscription.current_period_end) {
          updates.current_period_end = toIso(extendedSubscription.current_period_end);
        }
      }

      console.log('找到活跃订阅:', {
        subscriptionId: activeSubscription.id,
        status: activeSubscription.status,
        derivedStatus,
        periodStart: updates.current_period_start,
        periodEnd: updates.current_period_end
      });
    } else {
      // 没有活跃订阅
      updates.subscription_status = 'free';
      
      // 查找最近的已取消订阅，保留其结束时间
      const canceledSubscription = subscriptions.data
        .filter(sub => sub.status === 'canceled')
        .sort((a, b) => (b.canceled_at || 0) - (a.canceled_at || 0))[0];
      
      if (canceledSubscription) {
        const extendedSub = canceledSubscription as Stripe.Subscription & { 
          current_period_end?: number;
        };
        if (extendedSub.current_period_end) {
          updates.current_period_end = toIso(extendedSub.current_period_end);
        }
        console.log('找到已取消的订阅，保留结束时间');
      }
    }

    // 5. 更新数据库
    console.log('准备更新数据库:', {
      userId: profileUserId,
      updates
    });

    const { data: updatedData, error: updateError } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', profileUserId)
      .select('id, email, subscription_status, current_period_start, current_period_end');

    if (updateError) {
      console.error('更新用户订阅状态失败:', updateError);
      throw updateError;
    }

    console.log('更新成功:', updatedData);

    console.log('成功更新用户订阅状态:', updates);

    return successResponse({
      message: '订阅状态同步成功',
      userId: profileUserId,
      updates,
      subscriptions: subscriptions.data.map(sub => ({
        id: sub.id,
        status: sub.status,
        created: new Date(sub.created * 1000).toISOString(),
        trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
        trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        current_period_start: (sub as any).current_period_start ? new Date((sub as any).current_period_start * 1000).toISOString() : null,
        current_period_end: (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000).toISOString() : null,
      }))
    });

  } catch (error) {
    console.error('同步订阅状态错误:', error);
    return handleRouteError(error);
  }
};