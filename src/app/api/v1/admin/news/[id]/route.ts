import { supabase } from '@/lib/supabase';
import { handleRouteError } from '@/lib/api/error';
import { errorResponse, successResponse } from '@/lib/api/response';
import { serializeNews } from '@/lib/api/serializers';
import { NextRequest } from 'next/server';
import { z } from 'zod';

type News = {
  id: number;
  title: string;
  iso_date: string;
  link: string;
  content: string | null;
  ai_worth: boolean | null;
  ai_reason: string | null;
  ai_reason_en: string | null;
  ai_reason_ko: string | null;
  'translation-ko': string | null;
  'translation-en': string | null;
  'title-ko': string | null;
  'title-en': string | null;
  category: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const WEBHOOK_URL = process.env.PUBLISH_WEBHOOK_URL || '';

const notifyPublishWebhook = async (news: News) => {
  // 如果没有配置 webhook URL，跳过通知
  if (!WEBHOOK_URL) {
    console.warn('⚠️ PUBLISH_WEBHOOK_URL 未配置，跳过 webhook 通知');
    return;
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // 基本信息
        id: news.id,
        title: news.title,
        isoDate: news.iso_date,
        link: news.link,
        content: news.content,
        category: news.category,
        status: news.status,
        
        // AI 分析
        aiWorth: news.ai_worth,
        aiReason: news.ai_reason,
        aiReasonEn: news.ai_reason_en,
        aiReasonKo: news.ai_reason_ko,
        
        // 多语言翻译
        translationKo: news['translation-ko'],
        translationEn: news['translation-en'],
        titleKo: news['title-ko'],
        titleEn: news['title-en'],
      }),
    });

    if (!response.ok) {
      console.error(
        `发布状态 webhook 调用失败: ${response.status} ${response.statusText}`,
      );
    } else {
      console.log(`✅ Webhook 通知成功: News ID ${news.id} 已发布`);
    }
  } catch (error) {
    console.error('发布状态 webhook 调用异常:', error);
  }
};

const idSchema = z.coerce.number().int().min(1, '新闻ID必须是正整数');

const statusSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(z.enum(['DRAFT', 'PUBLISH']))

const updateSchema = z
  .object({
    title: z.string().min(1).max(1000).optional(),
    isoDate: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: '新闻日期格式不正确，请使用ISO8601格式',
      })
      .optional(),
    link: z.string().url('新闻链接格式不正确，请提供有效的URL').optional(),
    content: z.string().max(5000, '新闻内容长度不能超过5000字符').nullish(),
    aiWorth: z.boolean().nullish(),
    aiReason: z.string().max(2000, 'AI评估原因长度不能超过2000字符').nullish(),
    category: z.string().max(100, '新闻分类长度不能超过100字符').nullish(),
    titleKo: z.string().max(1000, '韩文标题长度不能超过1000字符').nullish(),
    titleEn: z.string().max(1000, '英文标题长度不能超过1000字符').nullish(),
    translationKo: z.string().max(5000, '韩文摘要长度不能超过5000字符').nullish(),
    translationEn: z.string().max(5000, '英文摘要长度不能超过5000字符').nullish(),
    categoryEn: z.string().max(100, '英文分类长度不能超过100字符').nullish(),
    categoryKo: z.string().max(100, '韩文分类长度不能超过100字符').nullish(),
    aiReasonEn: z.string().max(2000, '英文 AI 理由长度不能超过2000字符').nullish(),
    aiReasonKo: z.string().max(2000, '韩文 AI 理由长度不能超过2000字符').nullish(),
    status: statusSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: '至少需要提供一个字段进行更新',
  });

type UpdateInput = z.infer<typeof updateSchema>;

const buildUpdateData = (input: UpdateInput): Record<string, unknown> => {
  const data: Record<string, unknown> = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.isoDate !== undefined) data.iso_date = input.isoDate;
  if (input.link !== undefined) data.link = input.link;
  if (input.content !== undefined) data.content = input.content ?? null;
  if (input.aiWorth !== undefined) data.ai_worth = input.aiWorth ?? null;
  if (input.aiReason !== undefined) data.ai_reason = input.aiReason ?? null;
  if (input.category !== undefined) data.category = input.category ?? null;
  if (input.titleKo !== undefined) data['title-ko'] = input.titleKo ?? null;
  if (input.titleEn !== undefined) data['title-en'] = input.titleEn ?? null;
  if (input.translationKo !== undefined) data['translation-ko'] = input.translationKo ?? null;
  if (input.translationEn !== undefined) data['translation-en'] = input.translationEn ?? null;
  if (input.categoryEn !== undefined) data['category-en'] = input.categoryEn ?? null;
  if (input.categoryKo !== undefined) data['category-ko'] = input.categoryKo ?? null;
  if (input.aiReasonEn !== undefined) data.ai_reason_en = input.aiReasonEn ?? null;
  if (input.aiReasonKo !== undefined) data.ai_reason_ko = input.aiReasonKo ?? null;
  if (input.status !== undefined) data.status = input.status;

  return data;
};

const parseId = async (context: RouteContext) => {
  const { id } = await context.params;
  return idSchema.parse(id);
};

export const GET = async (_request: NextRequest, context: RouteContext) => {
  try {
    const id = await parseId(context);

    const { data: news, error } = await supabase
      .from('news')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !news) {
      return errorResponse('新闻不存在', { status: 404 });
    }

    return successResponse(serializeNews(news));
  } catch (error) {
    return handleRouteError(error);
  }
};

export const PUT = async (request: NextRequest, context: RouteContext) => {
  try {
    const id = await parseId(context);
    const payload = await request.json();
    const input = updateSchema.parse(payload);

    // 获取现有记录
    const { data: existing, error: fetchError } = await supabase
      .from('news')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return errorResponse('新闻不存在', { status: 404 });
    }

    // 更新记录
    const { data: updated, error: updateError } = await supabase
      .from('news')
      .update(buildUpdateData(input))
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updated) {
      throw updateError || new Error('更新失败');
    }

    // 检查是否需要触发 webhook
    if (existing.status !== 'PUBLISH' && updated.status === 'PUBLISH') {
      await notifyPublishWebhook(updated as News);
    }

    return successResponse(serializeNews(updated), { message: '新闻更新成功' });
  } catch (error) {
    return handleRouteError(error);
  }
};

export const DELETE = async (_request: NextRequest, context: RouteContext) => {
  try {
    const id = await parseId(context);

    // 检查记录是否存在
    const { data: existing, error: fetchError } = await supabase
      .from('news')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return errorResponse('新闻不存在', { status: 404 });
    }

    // 删除记录
    const { error: deleteError } = await supabase
      .from('news')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return successResponse({ id }, { message: '新闻删除成功' });
  } catch (error) {
    return handleRouteError(error);
  }
};
