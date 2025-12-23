import { supabase } from '@/lib/supabase';
import { handleRouteError } from '@/lib/api/error';
import { errorResponse, successResponse } from '@/lib/api/response';
import { serializeNews } from '@/lib/api/serializers';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = (process.env.OPENAI_API_BASE ?? process.env.OPENAI_BASE_URL)?.replace(/\/$/, '');
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const idSchema = z.coerce.number().int().min(1, '新闻ID必须是正整数');

const translationResponseSchema = z.object({
  titleEn: z.string().optional(),
  titleKo: z.string().optional(),
  contentEn: z.string().optional(),
  contentKo: z.string().optional(),
  categoryEn: z.string().optional(),
  categoryKo: z.string().optional(),
  aiReasonEn: z.string().optional(),
  aiReasonKo: z.string().optional(),
});

const translateContent = async (
  title: string | null,
  content: string | null,
  category: string | null,
  aiReason: string | null
) => {
  if (!OPENAI_API_KEY || !OPENAI_BASE_URL) {
    throw new Error('OpenAI 配置缺失');
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: '你是一个专业的新闻翻译助手，将中文新闻翻译成英文和韩文。保持专业、准确、简洁。对于分类词汇，请使用标准的新闻分类术语。'
        },
        {
          role: 'user',
          content: `请将以下中文内容翻译成英文和韩文，返回 JSON 格式：

标题：${title || ''}
内容：${content || ''}
分类：${category || ''}
AI理由：${aiReason || ''}

要求：
1. 如果某个字段为空，对应的翻译也返回空字符串
2. 保持新闻的专业性和准确性
3. 分类请使用标准的英文/韩文新闻分类术语

返回格式：
{
  "titleEn": "英文标题",
  "titleKo": "韩文标题",
  "contentEn": "英文内容",
  "contentKo": "韩文内容",
  "categoryEn": "英文分类",
  "categoryKo": "韩文分类",
  "aiReasonEn": "英文AI理由",
  "aiReasonKo": "韩文AI理由"
}`
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`翻译API调用失败: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const translationContent = data.choices?.[0]?.message?.content;
  
  if (!translationContent) {
    throw new Error('翻译API返回空内容');
  }

  const translations = JSON.parse(translationContent);
  return translationResponseSchema.parse(translations);
};

export const POST = async (_request: NextRequest, context: RouteContext) => {
  try {
    const { id } = await context.params;
    const newsId = idSchema.parse(id);

    // 获取新闻记录
    const { data: news, error: fetchError } = await supabase
      .from('news')
      .select('*')
      .eq('id', newsId)
      .single();

    if (fetchError || !news) {
      return errorResponse('新闻不存在', { status: 404 });
    }

    // 检查是否有中文内容需要翻译
    if (!news.title && !news.content && !news.category && !news.ai_reason) {
      return errorResponse('没有可翻译的中文内容');
    }

    console.log('开始翻译新闻:', { 
      id: newsId, 
      title: news.title,
      hasContent: !!news.content,
      hasCategory: !!news.category,
      hasAiReason: !!news.ai_reason
    });

    // 调用翻译API
    const translations = await translateContent(
      news.title,
      news.content,
      news.category,
      news.ai_reason
    );

    // 更新数据库
    const updateData: Record<string, string | null> = {};
    if (translations.titleEn) updateData['title-en'] = translations.titleEn;
    if (translations.titleKo) updateData['title-ko'] = translations.titleKo;
    if (translations.contentEn) updateData['translation-en'] = translations.contentEn;
    if (translations.contentKo) updateData['translation-ko'] = translations.contentKo;
    if (translations.categoryEn) updateData['category-en'] = translations.categoryEn;
    if (translations.categoryKo) updateData['category-ko'] = translations.categoryKo;
    if (translations.aiReasonEn) updateData.ai_reason_en = translations.aiReasonEn;
    if (translations.aiReasonKo) updateData.ai_reason_ko = translations.aiReasonKo;

    const { data: updated, error: updateError } = await supabase
      .from('news')
      .update(updateData)
      .eq('id', newsId)
      .select()
      .single();

    if (updateError || !updated) {
      throw updateError || new Error('更新翻译失败');
    }

    console.log('翻译完成并已保存:', { 
      id: newsId,
      translatedFields: Object.keys(updateData)
    });

    return successResponse(serializeNews(updated), { 
      message: '翻译成功' 
    });
  } catch (error) {
    console.error('翻译处理失败:', error);
    return handleRouteError(error);
  }
};