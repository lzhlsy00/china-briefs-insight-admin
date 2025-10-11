import { supabase } from '@/lib/supabase';
import { handleRouteError } from '@/lib/api/error';
import { errorResponse, successResponse } from '@/lib/api/response';
import { applyCorsHeaders, createCorsPreflightResponse } from '@/lib/api/cors';
import { NextRequest } from 'next/server';
import { z } from 'zod';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const idSchema = z.coerce.number().int().min(1, '新闻ID必须是正整数');

const parseId = async (context: RouteContext) => {
  const { id } = await context.params;
  return idSchema.parse(id);
};

export const GET = async (request: NextRequest, context: RouteContext) => {
  try {
    const id = await parseId(context);

    const { data: news, error } = await supabase
      .from('news')
      .select('*')
      .eq('id', id)
      .eq('status', 'PUBLISH')
      .single();

    if (error || !news) {
      return applyCorsHeaders(errorResponse('新闻不存在或未发布', { status: 404 }), request);
    }

    // 转换字段名为驼峰命名，移除 ai_reason
    const { 
      ai_reason,
      iso_date,
      ai_worth,
      ai_reason_en,
      ai_reason_ko,
      'translation-ko': translationKo,
      'translation-en': translationEn,
      'title-ko': titleKo,
      'title-en': titleEn,
      ...rest 
    } = news;

    const response = {
      ...rest,
      isoDate: iso_date,
      aiWorth: ai_worth,
      aiReasonEn: ai_reason_en,
      aiReasonKo: ai_reason_ko,
      translationKo,
      translationEn,
      titleKo,
      titleEn,
    };

    return applyCorsHeaders(successResponse(response), request);
  } catch (error) {
    return applyCorsHeaders(handleRouteError(error), request);
  }
};

export const OPTIONS = async (request: NextRequest) => createCorsPreflightResponse(request);
