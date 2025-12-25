import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api/response';
import { handleRouteError } from '@/lib/api/error';

// 内存中的发送队列（生产环境应该使用 Redis 或数据库）
const emailQueue = new Map<number, {
  contentId: number;
  recipients: Array<{ email: string; locale: string; subscription_status: string }>;
  currentIndex: number;
  options: {
    testMode?: boolean;
    ignoreLocale?: boolean;
    forceResend?: boolean;
  };
  status: 'running' | 'paused' | 'completed';
  results: {
    attempted: number;
    delivered: number;
    failed: number;
    failures: Array<{ email: string; error: string }>;
  };
  startedAt: string;
  lastSentAt?: string;
}>();

// 发送单封邮件
const sendSingleEmail = async (
  email: string,
  content: any,
  queueId: number
) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.RESEND_EMAIL_FROM;
  
  if (!resendApiKey || !emailFrom) {
    throw new Error('Resend 配置缺失');
  }
  
  const renderedContent = (content.content ?? '').replace(/\n/g, '<br />');
  const sendDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const rawSubject = (content.subject && content.subject.trim()) || 
    `BiteChina Newsletter - ${sendDate}`;
  const subject = rawSubject.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  
  const htmlBody = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${subject}</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1>${content.title || subject}</h1>
      <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin-top: 20px;">
        ${renderedContent}
        ${content.banner ? `<div style="margin-top: 20px;">${content.banner}</div>` : ''}
        ${content.footer ? `<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">${content.footer}</div>` : ''}
      </div>
      <p style="margin-top: 20px; color: #64748b; font-size: 14px;">
        Queue ID: ${queueId} | Sent at: ${new Date().toISOString()}
      </p>
    </div>
  </body>
</html>`;
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [email],
        subject,
        html: htmlBody,
      }),
    });
    
    const responseData = await response.json().catch(() => null);
    
    if (!response.ok) {
      return {
        success: false,
        error: responseData?.message || `HTTP ${response.status}`,
        details: responseData
      };
    }
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// 处理队列中的下一封邮件
const processNextEmail = async (queueId: number) => {
  const queue = emailQueue.get(queueId);
  if (!queue || queue.status !== 'running') {
    return null;
  }
  
  if (queue.currentIndex >= queue.recipients.length) {
    queue.status = 'completed';
    return null;
  }
  
  const recipient = queue.recipients[queue.currentIndex];
  
  // 获取内容
  const { data: content } = await supabase
    .from('push_content')
    .select('*')
    .eq('id', queue.contentId)
    .single();
    
  if (!content) {
    throw new Error('内容不存在');
  }
  
  // 发送邮件
  console.log(`[Queue ${queueId}] 发送邮件 ${queue.currentIndex + 1}/${queue.recipients.length}: ${recipient.email}`);
  
  const result = await sendSingleEmail(recipient.email, content, queueId);
  
  queue.results.attempted++;
  if (result.success) {
    queue.results.delivered++;
  } else {
    queue.results.failed++;
    queue.results.failures.push({
      email: recipient.email,
      error: result.error || 'Unknown error'
    });
  }
  
  // 记录到数据库
  await supabase
    .from('send_email')
    .insert({
      mail_content_id: queue.contentId,
      user_mail: recipient.email,
      is_delivered: result.success,
    });
    
  queue.currentIndex++;
  queue.lastSentAt = new Date().toISOString();
  
  return {
    email: recipient.email,
    success: result.success,
    error: result.error,
    remaining: queue.recipients.length - queue.currentIndex
  };
};

// 启动自动发送（每3秒发送一封）
const startAutoSend = (queueId: number) => {
  const sendInterval = setInterval(async () => {
    const queue = emailQueue.get(queueId);
    
    if (!queue || queue.status !== 'running') {
      clearInterval(sendInterval);
      return;
    }
    
    try {
      const result = await processNextEmail(queueId);
      
      if (!result) {
        clearInterval(sendInterval);
        console.log(`[Queue ${queueId}] 发送完成`);
      } else {
        console.log(`[Queue ${queueId}] 发送结果:`, result);
      }
    } catch (error) {
      console.error(`[Queue ${queueId}] 发送错误:`, error);
      queue.status = 'paused';
      clearInterval(sendInterval);
    }
  }, 3000); // 每3秒发送一封
};

export const POST = async (request: NextRequest) => {
  try {
    const { action, contentId, queueId, options = {} } = await request.json();
    
    switch (action) {
      case 'create': {
        // 创建新的发送队列
        if (!contentId) {
          return errorResponse('请提供 contentId');
        }
        
        // 获取内容
        const { data: content, error: contentError } = await supabase
          .from('push_content')
          .select('*')
          .eq('id', contentId)
          .single();
          
        if (contentError || !content) {
          return errorResponse('内容不存在');
        }
        
        // 获取已发送记录
        const { data: alreadySent } = await supabase
          .from('send_email')
          .select('user_mail')
          .eq('mail_content_id', contentId);
          
        const alreadySentSet = new Set(
          options.forceResend ? [] : (alreadySent ?? []).map(row => row.user_mail)
        );
        
        // 获取收件人
        let recipientQuery = supabase
          .from('user_profiles')
          .select('email, locale, subscription_status')
          .not('email', 'is', null);
          
        if (!options.testMode) {
          recipientQuery = recipientQuery.in('subscription_status', ['pro', 'trial']);
        }
        
        const { data: subscribers } = await recipientQuery;
        
        // 过滤收件人
        const targetLocale = content.local;
        const recipients = (subscribers ?? []).filter(user => {
          const email = user.email?.trim();
          if (!email || (!options.forceResend && alreadySentSet.has(email))) {
            return false;
          }
          
          if (options.ignoreLocale) {
            return true;
          }
          
          const userLocale = user.locale;
          if (targetLocale === 'KO') {
            return userLocale === 'KO';
          } else {
            return userLocale !== 'KO';
          }
        });
        
        // 创建队列
        const newQueueId = Date.now();
        emailQueue.set(newQueueId, {
          contentId,
          recipients,
          currentIndex: 0,
          options,
          status: 'running',
          results: {
            attempted: 0,
            delivered: 0,
            failed: 0,
            failures: []
          },
          startedAt: new Date().toISOString()
        });
        
        // 立即发送第一封
        const firstResult = await processNextEmail(newQueueId);
        
        // 启动自动发送
        startAutoSend(newQueueId);
        
        return successResponse({
          queueId: newQueueId,
          totalRecipients: recipients.length,
          content: {
            id: content.id,
            title: content.title,
            locale: content.local
          },
          firstEmail: firstResult,
          message: `队列创建成功，将每3秒发送一封邮件`
        });
      }
      
      case 'status': {
        // 查询队列状态
        if (!queueId) {
          // 返回所有队列
          const queues = Array.from(emailQueue.entries()).map(([id, queue]) => ({
            queueId: id,
            contentId: queue.contentId,
            status: queue.status,
            progress: `${queue.currentIndex}/${queue.recipients.length}`,
            results: queue.results,
            startedAt: queue.startedAt,
            lastSentAt: queue.lastSentAt
          }));
          
          return successResponse({ queues });
        }
        
        const queue = emailQueue.get(Number(queueId));
        if (!queue) {
          return errorResponse('队列不存在');
        }
        
        return successResponse({
          queueId,
          status: queue.status,
          progress: {
            current: queue.currentIndex,
            total: queue.recipients.length,
            percentage: ((queue.currentIndex / queue.recipients.length) * 100).toFixed(2) + '%'
          },
          results: queue.results,
          startedAt: queue.startedAt,
          lastSentAt: queue.lastSentAt,
          estimatedTimeRemaining: queue.status === 'running' 
            ? `${(queue.recipients.length - queue.currentIndex) * 3} 秒`
            : null
        });
      }
      
      case 'pause': {
        // 暂停队列
        if (!queueId) {
          return errorResponse('请提供 queueId');
        }
        
        const queue = emailQueue.get(Number(queueId));
        if (!queue) {
          return errorResponse('队列不存在');
        }
        
        queue.status = 'paused';
        return successResponse({ message: '队列已暂停' });
      }
      
      case 'resume': {
        // 恢复队列
        if (!queueId) {
          return errorResponse('请提供 queueId');
        }
        
        const queue = emailQueue.get(Number(queueId));
        if (!queue) {
          return errorResponse('队列不存在');
        }
        
        if (queue.status === 'completed') {
          return errorResponse('队列已完成，无法恢复');
        }
        
        queue.status = 'running';
        
        // 重新启动自动发送
        startAutoSend(Number(queueId));
        
        return successResponse({ message: '队列已恢复' });
      }
      
      case 'clear': {
        // 清除已完成的队列
        const clearedCount = Array.from(emailQueue.entries())
          .filter(([_, queue]) => queue.status === 'completed')
          .map(([id]) => {
            emailQueue.delete(id);
            return id;
          }).length;
          
        return successResponse({ 
          message: `清除了 ${clearedCount} 个已完成的队列` 
        });
      }
      
      default:
        return errorResponse('无效的 action');
    }
    
  } catch (error) {
    console.error('邮件队列错误:', error);
    return handleRouteError(error);
  }
};