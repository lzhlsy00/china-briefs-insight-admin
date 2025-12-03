import { supabase } from '@/lib/supabase';
import { handleRouteError } from '@/lib/api/error';
import { successResponse } from '@/lib/api/response';
import { applyCorsHeaders, createCorsPreflightResponse } from '@/lib/api/cors';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  category: z.string().min(1).max(100).optional(),
  hot: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  latest: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
});

export const GET = async (request: NextRequest) => {
  try {
    const params = Object.fromEntries(
      Array.from(request.nextUrl.searchParams.entries()).map(([key, value]) => [
        key,
        value || undefined,
      ])
    );

    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      return handleRouteError(parsed.error);
    }

    const query = parsed.data;
    const from = (query.page - 1) * query.limit;
    const to = from + query.limit - 1;

    // 构建 Supabase 查询
    let supabaseQuery = supabase
      .from('news')
      .select('*', { count: 'exact' })
      .eq('status', 'PUBLISH');

    // 分类过滤
    if (query.category) {
      supabaseQuery = supabaseQuery.ilike('category', `%${query.category}%`);
    }

    // 热点过滤
    if (query.hot) {
      supabaseQuery = supabaseQuery.eq('ai_worth', true);
    }

    // 排序
    if (query.latest) {
      supabaseQuery = supabaseQuery.order('iso_date', { ascending: false });
      supabaseQuery = supabaseQuery.order('id', { ascending: false });
    } else {
      supabaseQuery = supabaseQuery.order('id', { ascending: false });
    }

    // 分页
    supabaseQuery = supabaseQuery.range(from, to);

    const { data: news, error, count: total } = await supabaseQuery;

    if (error) {
      throw error;
    }

    // 序列化数据：转换字段名为驼峰命名，移除 ai_reason
    const serialized = (news || []).map((item) => {
      const {
        ai_reason: _aiReason,
        iso_date,
        ai_worth,
        ai_reason_en,
        ai_reason_ko,
        hero_image_url,
        'translation-ko': translationKo,
        'translation-en': translationEn,
        'title-ko': titleKo,
        'title-en': titleEn,
        ...rest
      } = item;

      void _aiReason;
      
      return {
        ...rest,
        isoDate: iso_date,
        aiWorth: ai_worth,
        aiReasonEn: ai_reason_en,
        aiReasonKo: ai_reason_ko,
        translationKo,
        translationEn,
        titleKo,
        titleEn,
        heroImageUrl: hero_image_url ?? null,
      };
    });

    const totalPages = query.limit > 0 && total ? Math.ceil(total / query.limit) : 0;

    const response = successResponse({
      news: serialized,
      pagination: {
        current: query.page,
        total: totalPages,
        count: serialized.length,
        totalCount: total || 0,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      },
    });

    return applyCorsHeaders(response, request);
  } catch (error) {
    return applyCorsHeaders(handleRouteError(error), request);
  }
};

export const OPTIONS = async (request: NextRequest) => createCorsPreflightResponse(request);
