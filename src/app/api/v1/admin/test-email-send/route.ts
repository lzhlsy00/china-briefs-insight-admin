import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api/response';
import { handleRouteError } from '@/lib/api/error';

// Mock 邮件内容用于测试
const createTestContent = async (locale: string) => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  
  const content = locale === 'KO' 
    ? `테스트 이메일입니다. 시간: ${now.toISOString()}`
    : `This is a test email. Time: ${now.toISOString()}`;
    
  const title = locale === 'KO'
    ? `테스트 이메일 - ${dateStr}`
    : `Test Email - ${dateStr}`;
    
  const subject = locale === 'KO'
    ? `BiteChina 테스트 이메일 - ${dateStr}`
    : `BiteChina Test Email - ${dateStr}`;

  // 创建测试推送内容
  const { data, error } = await supabase
    .from('push_content')
    .insert({
      title,
      subject,
      content,
      date: dateStr,
      published: false,
      local: locale,
      banner: null,
      footer: null
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

// 直接测试 Resend API
const testResendAPI = async (email: string) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.RESEND_EMAIL_FROM;
  
  if (!resendApiKey || !emailFrom) {
    return {
      success: false,
      error: 'Resend configuration missing'
    };
  }
  
  const subject = `BiteChina Test - ${new Date().toISOString()}`;
  const htmlBody = `
    <h1>Test Email</h1>
    <p>This is a test email sent at ${new Date().toISOString()}</p>
    <p>If you received this, the email system is working correctly.</p>
  `;
  
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
    
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }
    
    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// 测试 Supabase 边缘函数
const testSupabaseFunction = async (contentId: number) => {
  const endpoint = process.env.SEND_DIGEST_ENDPOINT;
  const token = process.env.SEND_DIGEST_TOKEN;
  
  if (!endpoint) {
    return {
      success: false,
      error: 'SEND_DIGEST_ENDPOINT not configured'
    };
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contentId }),
    });
    
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }
    
    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

export const POST = async (request: NextRequest) => {
  try {
    const { email, locale = 'EN', testType = 'full' } = await request.json();
    
    if (!email) {
      return errorResponse('请提供测试邮箱');
    }
    
    // 1. 检查用户是否存在
    const { data: user, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email, subscription_status, locale')
      .eq('email', email)
      .single();
      
    const userStatus = userError ? 'not_found' : {
      id: user.id,
      email: user.email,
      subscription_status: user.subscription_status,
      locale: user.locale
    };
    
    // 2. 检查环境配置
    const envCheck = {
      supabase_url: !!process.env.SUPABASE_URL,
      supabase_key: !!process.env.SUPABASE_SERVICE_KEY,
      resend_api_key: !!process.env.RESEND_API_KEY,
      resend_email_from: !!process.env.RESEND_EMAIL_FROM,
      send_digest_endpoint: !!process.env.SEND_DIGEST_ENDPOINT,
      send_digest_token: !!process.env.SEND_DIGEST_TOKEN,
    };
    
    const results: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      test_email: email,
      test_locale: locale,
      user_status: userStatus,
      env_check: envCheck,
    };
    
    // 3. 测试 Resend API
    if (testType === 'resend' || testType === 'full') {
      console.log('开始测试 Resend API...');
      const resendResult = await testResendAPI(email);
      results.resend_test = resendResult;
    }
    
    // 4. 完整测试（创建内容并发送）
    if (testType === 'full') {
      console.log('创建测试内容...');
      const testContent = await createTestContent(locale);
      results.test_content = {
        id: testContent.id,
        title: testContent.title,
        local: testContent.local
      };
      
      console.log('测试 Supabase Function...');
      const functionResult = await testSupabaseFunction(testContent.id);
      results.function_test = functionResult;
      
      // 5. 检查发送记录
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
      
      const { data: sendRecord, error: recordError } = await supabase
        .from('send_email')
        .select('*')
        .eq('mail_content_id', testContent.id)
        .eq('user_mail', email)
        .single();
        
      results.send_record = recordError ? {
        error: recordError.message,
        code: recordError.code
      } : sendRecord;
      
      // 6. 清理测试数据
      if (testContent.id) {
        await supabase
          .from('push_content')
          .delete()
          .eq('id', testContent.id);
      }
    }
    
    return successResponse(results);
    
  } catch (error) {
    console.error('测试邮件发送失败:', error);
    return handleRouteError(error);
  }
};