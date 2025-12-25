import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api/response';
import { handleRouteError } from '@/lib/api/error';

// 发送单封邮件的函数
const sendSingleEmail = async (
  email: string,
  content: any
): Promise<{ success: boolean; error?: string }> => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.RESEND_EMAIL_FROM;
  
  if (!resendApiKey || !emailFrom) {
    return { success: false, error: 'Resend 配置缺失' };
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
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return { 
        success: false, 
        error: errorData?.message || `HTTP ${response.status}` 
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

export const POST = async (request: NextRequest) => {
  try {
    const { 
      contentId, 
      offset = 0, 
      batchSize = 2,
      testMode = false,
      ignoreLocale = false,
      forceResend = false
    } = await request.json();
    
    if (!contentId) {
      return errorResponse('请提供 contentId');
    }
    
    console.log(`[批量发送] 开始处理批次: offset=${offset}, batchSize=${batchSize}`);
    
    // 1. 获取内容
    const { data: content, error: contentError } = await supabase
      .from('push_content')
      .select('*')
      .eq('id', contentId)
      .single();
      
    if (contentError || !content) {
      return errorResponse('内容不存在');
    }
    
    // 2. 获取已发送记录
    const { data: alreadySent } = await supabase
      .from('send_email')
      .select('user_mail')
      .eq('mail_content_id', contentId);
      
    const alreadySentSet = new Set(
      forceResend ? [] : (alreadySent ?? []).map(row => row.user_mail)
    );
    
    // 3. 获取所有符合条件的收件人
    let recipientQuery = supabase
      .from('user_profiles')
      .select('email, locale, subscription_status')
      .not('email', 'is', null)
      .order('created_at', { ascending: true }); // 确保顺序一致
      
    if (!testMode) {
      recipientQuery = recipientQuery.in('subscription_status', ['pro', 'trial']);
    }
    
    const { data: allSubscribers, error: subError } = await recipientQuery;
    
    if (subError) throw subError;
    
    // 4. 过滤收件人
    const targetLocale = content.local;
    const allRecipients = (allSubscribers ?? []).filter(user => {
      const email = user.email?.trim();
      if (!email || (!forceResend && alreadySentSet.has(email))) {
        return false;
      }
      
      if (ignoreLocale) {
        return true;
      }
      
      const userLocale = user.locale;
      if (targetLocale === 'KO') {
        return userLocale === 'KO';
      } else {
        return userLocale !== 'KO';
      }
    });
    
    const totalRecipients = allRecipients.length;
    
    // 5. 获取当前批次的收件人
    const currentBatch = allRecipients.slice(offset, offset + batchSize);
    
    if (currentBatch.length === 0) {
      return successResponse({
        message: '所有邮件已发送完成',
        completed: true,
        totalRecipients,
        totalSent: offset
      });
    }
    
    console.log(`[批量发送] 本批次收件人: ${currentBatch.map(r => r.email).join(', ')}`);
    
    // 6. 发送邮件
    const results = {
      attempted: currentBatch.length,
      delivered: 0,
      failed: 0,
      failures: [] as Array<{ email: string; error: string }>
    };
    
    for (const recipient of currentBatch) {
      const email = recipient.email?.trim();
      if (!email) continue;
      
      console.log(`[批量发送] 发送邮件给: ${email}`);
      
      const result = await sendSingleEmail(email, content);
      
      if (result.success) {
        results.delivered++;
      } else {
        results.failed++;
        results.failures.push({
          email,
          error: result.error || 'Unknown error'
        });
      }
      
      // 记录到数据库
      await supabase
        .from('send_email')
        .insert({
          mail_content_id: contentId,
          user_mail: email,
          is_delivered: result.success,
        });
    }
    
    // 7. 计算下一批次
    const nextOffset = offset + batchSize;
    const hasMore = nextOffset < totalRecipients;
    
    console.log(`[批量发送] 批次完成: 成功=${results.delivered}, 失败=${results.failed}, 下一批=${nextOffset}`);
    
    return successResponse({
      content: {
        id: content.id,
        title: content.title,
        locale: content.local
      },
      batch: {
        offset,
        size: currentBatch.length,
        results
      },
      progress: {
        sent: offset + currentBatch.length,
        total: totalRecipients,
        percentage: ((offset + currentBatch.length) / totalRecipients * 100).toFixed(1)
      },
      next: hasMore ? {
        offset: nextOffset,
        batchSize,
        hasMore: true
      } : null,
      completed: !hasMore
    });
    
  } catch (error) {
    console.error('批量发送邮件失败:', error);
    return handleRouteError(error);
  }
};