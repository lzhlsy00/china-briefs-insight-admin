import { supabase } from '@/lib/supabase';
import { handleRouteError } from '@/lib/api/error';
import { successResponse } from '@/lib/api/response';
import { serializeNewsList } from '@/lib/api/serializers';
import { applyCorsHeaders, createCorsPreflightResponse } from '@/lib/api/cors';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const querySchema = z.object({
  q: z.string().min(1, '搜索关键词不能为空'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
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

    // 使用 Supabase 搜索（title 或 content 包含关键词）
    const { data: news, error, count: total } = await supabase
      .from('news')
      .select('*', { count: 'exact' })
      .eq('status', 'PUBLISH')
      .or(`title.ilike.%${query.q}%,content.ilike.%${query.q}%`)
      .order('iso_date', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const serialized = serializeNewsList(news || []).map(({ aiReason: _aiReason, status: _status, ...rest }) => {
      void _aiReason;
      void _status;
      return { ...rest };
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
      keyword: query.q,
    });
    return applyCorsHeaders(response, request);
  } catch (error) {
    return applyCorsHeaders(handleRouteError(error), request);
  }
};

export const OPTIONS = async (request: NextRequest) => createCorsPreflightResponse(request);
