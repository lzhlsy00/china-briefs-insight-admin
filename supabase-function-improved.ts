// 这是改进版的 send-digest 函数，添加了速率限制处理
// 复制到 china-briefs-insight/supabase/functions/send-digest/index.ts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const payload = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[SEND-DIGEST] ${step}${payload}`);
};

// 添加延迟函数，避免速率限制
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 批量发送邮件，带重试机制
const sendEmailBatch = async (
  emails: Array<{ email: string; recipient: any }>,
  emailConfig: { from: string; subject: string; html: string; apiKey: string }
) => {
  const results = [];
  const BATCH_SIZE = 2; // 每批发送2封
  const BATCH_DELAY = 5000; // 批次间隔5秒（避免速率限制）
  const RETRY_DELAY = 5000; // 重试延迟5秒
  const MAX_RETRIES = 3; // 最大重试次数

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    
    // 发送当前批次
    const batchPromises = batch.map(async ({ email, recipient }) => {
      let attempts = 0;
      let delivered = false;
      let errorMessage = "";
      
      while (attempts < MAX_RETRIES && !delivered) {
        attempts++;
        
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${emailConfig.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: emailConfig.from,
              to: [email],
              subject: emailConfig.subject,
              html: emailConfig.html,
            }),
          });

          if (response.ok) {
            delivered = true;
            logStep(`Email sent successfully`, { email, attempt: attempts });
          } else {
            const errorPayload = await response.json().catch(() => null);
            errorMessage = errorPayload?.message || `HTTP ${response.status}`;
            
            // 如果是速率限制错误，等待后重试
            if (response.status === 429 && attempts < MAX_RETRIES) {
              logStep(`Rate limited, retrying...`, { email, attempt: attempts });
              await delay(RETRY_DELAY * attempts); // 递增延迟
            } else {
              break; // 其他错误不重试
            }
          }
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : String(error);
          logStep(`Network error`, { email, error: errorMessage, attempt: attempts });
          
          if (attempts < MAX_RETRIES) {
            await delay(RETRY_DELAY * attempts);
          }
        }
      }
      
      return { email, recipient, delivered, errorMessage, attempts };
    });
    
    // 等待当前批次完成
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // 如果还有更多邮件要发送，等待避免速率限制
    if (i + BATCH_SIZE < emails.length) {
      await delay(BATCH_DELAY);
    }
  }
  
  return results;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const emailFrom = Deno.env.get("RESEND_EMAIL_FROM") ?? "";
  const siteUrl = Deno.env.get("SITE_NEWS_BASE_URL") ?? "https://www.bitechina.com";

  // 检查配置
  if (!supabaseUrl || !serviceRoleKey) {
    logStep("Missing Supabase credentials");
    return new Response(JSON.stringify({ error: "Supabase credentials are not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!resendApiKey || !emailFrom) {
    logStep("Missing Resend configuration", {
      hasApiKey: !!resendApiKey,
      hasEmailFrom: !!emailFrom,
      emailFromValue: emailFrom || "not set"
    });
    return new Response(JSON.stringify({ error: "Resend configuration is not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 获取要发送的内容（保持原逻辑）
    const { contentId } = await req.json().catch(() => ({ contentId: null }));
    
    // ... [获取内容的代码保持不变] ...
    
    // 准备邮件内容
    const renderedContent = (latestContent.content ?? "").replace(/\n/g, "<br />");
    const sendDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    const rawSubject = (latestContent.subject && latestContent.subject.trim()) || 
      `BiteChina Newsletter - ${sendDate}`;
    const subject = rawSubject.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    
    // ... [HTML 模板保持不变] ...
    
    // 准备收件人列表
    const emailList = recipients.map(recipient => ({
      email: recipient.email?.trim(),
      recipient
    })).filter(item => item.email);
    
    logStep("Starting batch email send", { 
      total: emailList.length,
      contentId: latestContent.id 
    });
    
    // 批量发送邮件
    const sendResults = await sendEmailBatch(emailList, {
      from: emailFrom,
      subject,
      html: htmlBody,
      apiKey: resendApiKey
    });
    
    // 统计结果
    const summary = {
      attempted: sendResults.length,
      delivered: 0,
      failed: 0,
      failures: [] as Array<{ email: string; error: string }>
    };
    
    // 记录发送结果
    for (const result of sendResults) {
      if (result.delivered) {
        summary.delivered += 1;
      } else {
        summary.failed += 1;
        summary.failures.push({
          email: result.email,
          error: result.errorMessage || "Unknown error"
        });
      }
      
      // 记录到数据库
      const { error: insertError } = await supabase
        .from("send_email")
        .insert({
          mail_content_id: latestContent.id,
          user_mail: result.email,
          is_delivered: result.delivered,
        });
        
      if (insertError) {
        logStep("Failed to record send log", { 
          email: result.email, 
          error: insertError.message 
        });
      }
    }
    
    // 标记内容为已发布
    if (summary.attempted > 0) {
      const { error: publishError } = await supabase
        .from("push_content")
        .update({ published: true })
        .eq("id", latestContent.id);
        
      if (publishError) {
        logStep("Failed to mark content as published", { 
          contentId: latestContent.id, 
          error: publishError.message 
        });
      }
    }
    
    logStep("Email send completed", summary);
    
    return new Response(JSON.stringify({
      contentId: latestContent.id,
      attempted: summary.attempted,
      delivered: summary.delivered,
      failed: summary.failed,
      failures: summary.failures,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    logStep("ERROR", { 
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined 
    });
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});