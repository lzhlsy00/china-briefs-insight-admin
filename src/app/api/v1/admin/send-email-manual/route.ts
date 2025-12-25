import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api/response';
import { handleRouteError } from '@/lib/api/error';

interface SendOptions {
  contentId: number;
  testMode?: boolean; // 测试模式，忽略订阅状态
  ignoreLocale?: boolean; // 忽略语言匹配
  specificEmails?: string[]; // 只发送给特定邮箱
  forceResend?: boolean; // 强制重发（忽略已发送记录）
}

export const POST = async (request: NextRequest) => {
  try {
    const options: SendOptions = await request.json();
    const { contentId, testMode = false, ignoreLocale = false, specificEmails, forceResend = false } = options;
    
    if (!contentId) {
      return errorResponse('请提供 contentId');
    }
    
    // 1. 获取要发送的内容
    const { data: content, error: contentError } = await supabase
      .from('push_content')
      .select('*')
      .eq('id', contentId)
      .single();
      
    if (contentError || !content) {
      return errorResponse('内容不存在');
    }
    
    // 2. 获取已发送记录
    const { data: alreadySent, error: sentError } = await supabase
      .from('send_email')
      .select('user_mail')
      .eq('mail_content_id', contentId);
      
    if (sentError) throw sentError;
    
    const alreadySentSet = new Set(
      forceResend ? [] : (alreadySent ?? []).map(row => row.user_mail)
    );
    
    // 3. 获取收件人列表
    let recipientQuery = supabase
      .from('user_profiles')
      .select('email, locale, subscription_status')
      .not('email', 'is', null);
      
    // 测试模式不过滤订阅状态
    if (!testMode) {
      recipientQuery = recipientQuery.in('subscription_status', ['pro', 'trial']);
    }
    
    // 如果指定了特定邮箱
    if (specificEmails && specificEmails.length > 0) {
      recipientQuery = recipientQuery.in('email', specificEmails);
    }
    
    const { data: subscribers, error: subError } = await recipientQuery;
    
    if (subError) throw subError;
    
    // 4. 过滤收件人
    const targetLocale = content.local;
    const recipients = (subscribers ?? []).filter(user => {
      const email = user.email?.trim();
      if (!email || (!forceResend && alreadySentSet.has(email))) {
        return false;
      }
      
      // 语言匹配逻辑
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
    
    // 5. 准备邮件内容
    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.RESEND_EMAIL_FROM;
    
    if (!resendApiKey || !emailFrom) {
      return errorResponse('Resend 配置缺失');
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
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f8fafc;">
    <table width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 0;">
      <tr>
        <td align="center">
          <table width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 35px rgba(15, 23, 42, 0.08); overflow: hidden;">
            <tr>
              <td style="padding: 32px 32px 16px 32px; text-align: center;">
                <h1 style="font-size: 28px; font-weight: 700; margin: 0; color: #0f172a;">${content.title || subject}</h1>
                ${testMode ? '<p style="color: #dc2626; font-size: 14px; margin: 8px 0;">⚠️ 测试邮件</p>' : ''}
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px 32px 32px;">
                <div style="border-radius: 12px; background: #f1f5f9; color: #0f172a; padding: 24px; font-size: 16px; line-height: 1.7;">
                  ${renderedContent}
                  ${content.banner ? `<div style="margin-top: 24px;">${content.banner}</div>` : ''}
                  ${content.footer ? `<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b;">${content.footer}</div>` : ''}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    
    // 6. 发送邮件
    const results = {
      attempted: recipients.length,
      delivered: 0,
      failed: 0,
      failures: [] as Array<{ email: string; error: string; details?: unknown }>
    };
    
    for (const recipient of recipients) {
      const email = recipient.email?.trim();
      if (!email) continue;
      
      let delivered = false;
      let errorMessage = '';
      let errorDetails: unknown = null;
      
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
            tags: testMode ? [{ name: 'test', value: 'manual' }] : undefined
          }),
        });
        
        const responseData = await response.json().catch(() => null);
        
        if (!response.ok) {
          errorMessage = responseData?.message || `HTTP ${response.status}`;
          errorDetails = responseData;
          console.error('Resend 错误:', email, responseData);
        } else {
          delivered = true;
          results.delivered += 1;
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
        errorDetails = error;
        console.error('发送失败:', email, error);
      }
      
      if (!delivered) {
        results.failed += 1;
        results.failures.push({ 
          email, 
          error: errorMessage,
          details: errorDetails
        });
      }
      
      // 记录发送日志
      const { error: logError } = await supabase
        .from('send_email')
        .insert({
          mail_content_id: contentId,
          user_mail: email,
          is_delivered: delivered,
        });
        
      if (logError) {
        console.error('记录日志失败:', logError);
      }
      
      // 避免发送过快，每2封邮件等待5秒
      if ((recipients.indexOf(recipient) + 1) % 2 === 0) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // 7. 更新内容状态（如果全部发送完成）
    if (!testMode && results.attempted > 0 && !specificEmails) {
      const { error: updateError } = await supabase
        .from('push_content')
        .update({ published: true })
        .eq('id', contentId);
        
      if (updateError) {
        console.error('更新内容状态失败:', updateError);
      }
    }
    
    return successResponse({
      content: {
        id: content.id,
        title: content.title,
        locale: content.local
      },
      options: {
        testMode,
        ignoreLocale,
        forceResend,
        specificEmails: specificEmails?.length || 0
      },
      results,
      message: `发送完成：成功 ${results.delivered}，失败 ${results.failed}`
    });
    
  } catch (error) {
    console.error('手动发送邮件失败:', error);
    return handleRouteError(error);
  }
};