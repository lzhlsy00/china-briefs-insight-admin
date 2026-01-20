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
    console.error(`[配置缺失] RESEND_API_KEY: ${resendApiKey ? '已设置' : '未设置'}, RESEND_EMAIL_FROM: ${emailFrom ? '已设置' : '未设置'}`);
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
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f8fafc;">
    <table width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 0;">
      <tr>
        <td align="center">
          <table width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 35px rgba(15, 23, 42, 0.08); overflow: hidden;">
            ${content.logo ? `
            <tr>
              <td style="padding: 32px 32px 16px 32px; text-align: center;">
                <img src="${content.logo}" alt="BiteChina" style="max-width: 180px; height: auto;" />
              </td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 16px 32px 8px 32px; text-align: center;">
                <h1 style="font-size: 24px; font-weight: 700; margin: 0; color: #0f172a;">${content.title || subject}</h1>
              </td>
            </tr>
            ${content.subject ? `
            <tr>
              <td style="padding: 0 32px 16px 32px; text-align: center;">
                <p style="font-size: 14px; color: #64748b; margin: 0; line-height: 1.5;">${content.subject.replace(/[\r\n]+/g, '<br />')}</p>
              </td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 0 32px 32px 32px;">
                <div style="border-radius: 12px; background: #f1f5f9; color: #0f172a; padding: 24px; font-size: 16px; line-height: 1.7;">
                  ${renderedContent}
                </div>
                ${content.banner ? `
                <div style="margin-top: 24px; padding: 16px; background: #e0f2fe; border-radius: 8px; font-size: 14px; color: #0369a1;">
                  ${content.banner.replace(/\n/g, '<br />')}
                </div>
                ` : ''}
                ${content.footer ? `
                <div style="margin-top: 32px; padding: 20px; background: #f8fafc; border-radius: 8px; font-size: 14px; color: #475569;">
                  ${content.footer.replace(/\n/g, '<br />')}
                </div>
                ` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 32px; text-align: center; font-size: 11px; color: #94a3b8;">
                Sent on ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
      console.error(`[Resend 错误] ${email}:`, errorData);
      return {
        success: false,
        error: errorData?.message || `HTTP ${response.status}`
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error(`[发送异常] ${email}:`, error);
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

    // 始终使用激活模板的 logo（优先级高于 push_content 中存储的值）
    const { data: activeTemplate } = await supabase
      .from('template')
      .select('logo')
      .eq('is_active', true)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeTemplate?.logo) {
      content.logo = activeTemplate.logo;
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
        console.error(`[批量发送] 发送失败 ${email}: ${result.error}`);
        results.failures.push({
          email,
          error: result.error || 'Unknown error'
        });
      }
      
      // 记录到数据库
      const { error: dbError } = await supabase
        .from('send_email')
        .insert({
          mail_content_id: contentId,
          user_mail: email,
          is_delivered: result.success,
        });

      if (dbError) {
        console.error(`[批量发送] 数据库记录失败 ${email}:`, dbError);
      }
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