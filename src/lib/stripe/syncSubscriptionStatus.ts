import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeClient = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-09-30.clover' })
  : null;

export interface SyncResult {
  success: boolean;
  message: string;
  userId?: string;
  oldStatus?: string;
  newStatus?: string;
  error?: string;
}

/**
 * 同步用户的 Stripe 订阅状态到 Supabase
 */
export async function syncUserSubscriptionStatus(email: string): Promise<SyncResult> {
  try {
    if (!stripeClient) {
      return {
        success: false,
        message: 'Stripe 未配置',
        error: 'STRIPE_SECRET_KEY 未设置'
      };
    }

    // 1. 查找 Supabase 用户
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email, subscription_status')
      .eq('email', email)
      .single();

    if (userError || !userProfile) {
      return {
        success: false,
        message: '用户不存在',
        error: userError?.message
      };
    }

    const oldStatus = userProfile.subscription_status;

    // 2. 查找 Stripe 客户
    const customers = await stripeClient.customers.list({
      email: email,
      limit: 1
    });

    let newStatus = 'free';
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;

      // 3. 获取订阅
      const subscriptions = await stripeClient.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10,
      });

      // 查找活跃订阅
      const activeSubscription = subscriptions.data.find(sub => 
        sub.status === 'active' || 
        sub.status === 'trialing' || 
        sub.status === 'past_due'
      );

      if (activeSubscription) {
        newStatus = 'pro';
        
        // 处理试用期
        if (activeSubscription.status === 'trialing') {
          if (activeSubscription.trial_start) {
            periodStart = new Date(activeSubscription.trial_start * 1000).toISOString();
          }
          if (activeSubscription.trial_end) {
            periodEnd = new Date(activeSubscription.trial_end * 1000).toISOString();
          }
        } else {
          // 正常订阅
          const extSub = activeSubscription as Stripe.Subscription & {
            current_period_start?: number;
            current_period_end?: number;
          };
          if (extSub.current_period_start) {
            periodStart = new Date(extSub.current_period_start * 1000).toISOString();
          }
          if (extSub.current_period_end) {
            periodEnd = new Date(extSub.current_period_end * 1000).toISOString();
          }
        }
      }
    }

    // 4. 更新数据库
    const updates: Record<string, string | null> = {
      subscription_status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (periodStart) updates.current_period_start = periodStart;
    if (periodEnd) updates.current_period_end = periodEnd;

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userProfile.id);

    if (updateError) {
      return {
        success: false,
        message: '更新数据库失败',
        error: updateError.message,
        userId: userProfile.id,
        oldStatus,
        newStatus
      };
    }

    return {
      success: true,
      message: `订阅状态已从 ${oldStatus} 更新为 ${newStatus}`,
      userId: userProfile.id,
      oldStatus,
      newStatus
    };

  } catch (error) {
    return {
      success: false,
      message: '同步失败',
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 批量同步所有用户的订阅状态
 */
export async function syncAllUsersSubscriptionStatus(): Promise<{
  total: number;
  success: number;
  failed: number;
  results: SyncResult[];
}> {
  const results: SyncResult[] = [];
  let success = 0;
  let failed = 0;

  try {
    // 获取所有用户
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('email')
      .not('email', 'is', null);

    if (error || !users) {
      return { total: 0, success: 0, failed: 0, results: [] };
    }

    // 逐个同步
    for (const user of users) {
      if (user.email) {
        const result = await syncUserSubscriptionStatus(user.email);
        results.push(result);
        
        if (result.success) {
          success++;
        } else {
          failed++;
        }

        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      total: users.length,
      success,
      failed,
      results
    };

  } catch {
    return {
      total: 0,
      success,
      failed,
      results
    };
  }
}