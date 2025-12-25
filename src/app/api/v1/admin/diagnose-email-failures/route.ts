import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api/response';
import { handleRouteError } from '@/lib/api/error';

export const POST = async (request: NextRequest) => {
  try {
    const { emails } = await request.json();
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return errorResponse('请提供要诊断的邮箱列表');
    }
    
    const diagnoses = [];
    
    for (const email of emails.slice(0, 10)) { // 限制最多检查10个
      const diagnosis: Record<string, unknown> = {
        email,
        issues: [],
        recommendations: []
      };
      
      // 1. 检查用户是否存在
      const { data: user, error: userError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .single();
        
      if (userError || !user) {
        diagnosis.user_exists = false;
        diagnosis.issues.push('用户不存在于 user_profiles 表');
        diagnosis.recommendations.push('确保用户已注册');
        diagnoses.push(diagnosis);
        continue;
      }
      
      diagnosis.user_exists = true;
      diagnosis.user_data = {
        id: user.id,
        email: user.email,
        subscription_status: user.subscription_status,
        locale: user.locale,
        created_at: user.created_at
      };
      
      // 2. 检查订阅状态
      if (!['pro', 'trial'].includes(user.subscription_status)) {
        diagnosis.issues.push(`订阅状态为 "${user.subscription_status}"，只有 "pro" 或 "trial" 才能收到邮件`);
        diagnosis.recommendations.push('用户需要有效的订阅才能收到邮件');
      }
      
      // 3. 检查最近的发送记录
      const { data: recentSends, error: sendsError } = await supabase
        .from('send_email')
        .select('*')
        .eq('user_mail', email)
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (!sendsError && recentSends) {
        diagnosis.recent_sends = recentSends.map(send => ({
          content_id: send.mail_content_id,
          delivered: send.is_delivered,
          created_at: send.created_at || send.createdAt
        }));
        
        const failedCount = recentSends.filter(s => !s.is_delivered).length;
        if (failedCount > 0) {
          diagnosis.issues.push(`最近5次发送中有 ${failedCount} 次失败`);
        }
      }
      
      // 4. 检查邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        diagnosis.issues.push('邮箱格式无效');
        diagnosis.recommendations.push('检查邮箱地址是否正确');
      }
      
      // 5. 检查域名黑名单（常见的临时邮箱）
      const blacklistedDomains = ['tempmail.com', 'guerrillamail.com', '10minutemail.com'];
      const emailDomain = email.split('@')[1];
      if (blacklistedDomains.includes(emailDomain)) {
        diagnosis.issues.push('使用了临时邮箱服务');
        diagnosis.recommendations.push('建议使用真实邮箱地址');
      }
      
      // 6. 测试 Resend API（模拟发送）
      if (process.env.RESEND_API_KEY && process.env.RESEND_EMAIL_FROM) {
        try {
          const testResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: process.env.RESEND_EMAIL_FROM,
              to: [email],
              subject: 'BiteChina Email Diagnosis Test',
              html: '<p>This is a test email to diagnose delivery issues.</p>',
              tags: [
                { name: 'test', value: 'diagnosis' }
              ]
            }),
          });
          
          if (!testResponse.ok) {
            const errorData = await testResponse.json().catch(() => ({}));
            diagnosis.resend_test = {
              success: false,
              status: testResponse.status,
              error: errorData
            };
            
            // 分析 Resend 错误
            if (errorData.name === 'validation_error') {
              diagnosis.issues.push('Resend API 验证错误');
              if (errorData.message?.includes('email')) {
                diagnosis.issues.push('邮箱地址可能被 Resend 拒绝');
                diagnosis.recommendations.push('检查邮箱是否在 Resend 黑名单中');
              }
            } else if (testResponse.status === 429) {
              diagnosis.issues.push('Resend API 速率限制');
              diagnosis.recommendations.push('等待一段时间后重试');
            }
          } else {
            diagnosis.resend_test = {
              success: true,
              message: '测试邮件已成功发送'
            };
          }
        } catch (error) {
          diagnosis.resend_test = {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
      
      // 7. 语言匹配检查
      const { data: recentContents } = await supabase
        .from('push_content')
        .select('id, local, title')
        .eq('published', false)
        .order('date', { ascending: false })
        .limit(3);
        
      if (recentContents && recentContents.length > 0) {
        diagnosis.locale_matching = recentContents.map(content => {
          const wouldReceive = (content.local === 'KO' && user.locale === 'KO') || 
                              (content.local !== 'KO' && user.locale !== 'KO');
          return {
            content_id: content.id,
            content_locale: content.local,
            user_locale: user.locale,
            would_receive: wouldReceive,
            reason: wouldReceive ? '语言匹配' : '语言不匹配'
          };
        });
        
        const mismatchCount = diagnosis.locale_matching.filter(m => !m.would_receive).length;
        if (mismatchCount > 0) {
          diagnosis.issues.push(`最近 ${mismatchCount} 封邮件因语言不匹配而未发送`);
          diagnosis.recommendations.push('检查用户语言设置是否正确');
        }
      }
      
      // 总结
      if (diagnosis.issues.length === 0) {
        diagnosis.status = 'healthy';
        diagnosis.message = '未发现明显问题';
      } else {
        diagnosis.status = 'issues_found';
        diagnosis.message = `发现 ${diagnosis.issues.length} 个问题`;
      }
      
      diagnoses.push(diagnosis);
    }
    
    // 全局建议
    const globalRecommendations = [];
    
    // 检查 Resend 配置
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_EMAIL_FROM) {
      globalRecommendations.push('Resend API 配置缺失，请检查环境变量');
    }
    
    // 统计问题
    const totalIssues = diagnoses.reduce((sum, d) => sum + (d.issues as string[]).length, 0);
    const subscriptionIssues = diagnoses.filter(d => 
      (d.issues as string[]).some(i => i.includes('订阅状态'))
    ).length;
    const localeIssues = diagnoses.filter(d => 
      (d.issues as string[]).some(i => i.includes('语言'))
    ).length;
    
    if (subscriptionIssues > emails.length / 2) {
      globalRecommendations.push('大部分用户订阅状态有问题，考虑检查订阅同步机制');
    }
    
    if (localeIssues > emails.length / 2) {
      globalRecommendations.push('大部分用户存在语言匹配问题，考虑优化语言设置逻辑');
    }
    
    return successResponse({
      summary: {
        total_checked: emails.length,
        total_issues: totalIssues,
        subscription_issues: subscriptionIssues,
        locale_issues: localeIssues
      },
      diagnoses,
      global_recommendations: globalRecommendations
    });
    
  } catch (error) {
    console.error('诊断邮件失败:', error);
    return handleRouteError(error);
  }
};