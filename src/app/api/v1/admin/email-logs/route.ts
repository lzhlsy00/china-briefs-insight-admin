import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api/response';
import { handleRouteError } from '@/lib/api/error';

export const GET = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const onlyFailed = searchParams.get('failed') === 'true';
    
    // 1. 获取最近的发送记录
    let query = supabase
      .from('send_email')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (onlyFailed) {
      query = query.eq('is_delivered', false);
    }
    
    const { data: logs, error: logsError } = await query;
    
    if (logsError) throw logsError;
    
    // 2. 获取相关的推送内容信息
    const contentIds = [...new Set(logs?.map(log => log.mail_content_id).filter(Boolean) || [])];
    
    const { data: contents, error: contentsError } = await supabase
      .from('push_content')
      .select('id, title, local, date')
      .in('id', contentIds);
      
    if (contentsError) throw contentsError;
    
    const contentMap = new Map(contents?.map(c => [c.id, c]) || []);
    
    // 3. 分析失败原因
    const failureAnalysis = {
      total_logs: logs?.length || 0,
      failed_count: logs?.filter(log => !log.is_delivered).length || 0,
      success_count: logs?.filter(log => log.is_delivered).length || 0,
      failure_by_email: {} as Record<string, number>,
      failure_by_content: {} as Record<number, { count: number; title: string }>,
      recent_failures: [] as Array<{
        email: string;
        content_id: number;
        content_title: string;
        content_locale: string;
        created_at: string;
      }>
    };
    
    // 分析失败记录
    logs?.forEach(log => {
      if (!log.is_delivered) {
        // 按邮箱统计
        if (log.user_mail) {
          failureAnalysis.failure_by_email[log.user_mail] = 
            (failureAnalysis.failure_by_email[log.user_mail] || 0) + 1;
        }
        
        // 按内容统计
        if (log.mail_content_id) {
          const content = contentMap.get(log.mail_content_id);
          if (!failureAnalysis.failure_by_content[log.mail_content_id]) {
            failureAnalysis.failure_by_content[log.mail_content_id] = {
              count: 0,
              title: content?.title || 'Unknown'
            };
          }
          failureAnalysis.failure_by_content[log.mail_content_id].count++;
        }
        
        // 最近失败记录
        if (failureAnalysis.recent_failures.length < 20) {
          const content = contentMap.get(log.mail_content_id);
          failureAnalysis.recent_failures.push({
            email: log.user_mail || 'unknown',
            content_id: log.mail_content_id || 0,
            content_title: content?.title || 'Unknown',
            content_locale: content?.local || 'Unknown',
            created_at: log.created_at || log.createdAt || log.inserted_at || log.insertedAt || ''
          });
        }
      }
    });
    
    // 4. 检查用户状态
    const failedEmails = Object.keys(failureAnalysis.failure_by_email).slice(0, 10);
    
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('email, subscription_status, locale')
      .in('email', failedEmails);
      
    const userMap = new Map(users?.map(u => [u.email, u]) || []);
    
    const user_analysis = failedEmails.map(email => ({
      email,
      failure_count: failureAnalysis.failure_by_email[email],
      user_status: userMap.get(email) || 'not_found'
    }));
    
    // 5. 检查 Resend 配置
    const config_check = {
      has_resend_api_key: !!process.env.RESEND_API_KEY,
      has_resend_from: !!process.env.RESEND_EMAIL_FROM,
      resend_from_value: process.env.RESEND_EMAIL_FROM || 'not_configured',
      has_send_digest_endpoint: !!process.env.SEND_DIGEST_ENDPOINT,
      send_digest_endpoint: process.env.SEND_DIGEST_ENDPOINT || 'not_configured'
    };
    
    return successResponse({
      summary: {
        total_logs: failureAnalysis.total_logs,
        failed_count: failureAnalysis.failed_count,
        success_count: failureAnalysis.success_count,
        failure_rate: failureAnalysis.total_logs > 0 
          ? ((failureAnalysis.failed_count / failureAnalysis.total_logs) * 100).toFixed(2) + '%'
          : '0%'
      },
      failure_analysis: failureAnalysis,
      user_analysis: user_analysis.slice(0, 10),
      config_check,
      raw_logs: onlyFailed ? logs : logs?.slice(0, 20)
    });
    
  } catch (error) {
    console.error('获取邮件日志失败:', error);
    return handleRouteError(error);
  }
};