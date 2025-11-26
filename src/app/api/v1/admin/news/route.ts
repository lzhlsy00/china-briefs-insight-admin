import { supabase } from '@/lib/supabase';
import { handleRouteError } from '@/lib/api/error';
import { successResponse } from '@/lib/api/response';
import { serializeNewsList } from '@/lib/api/serializers';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  category: z.string().min(1).max(100).optional(),
  status: z.enum(['DRAFT', 'PUBLISH']).optional(),
  title: z.string().min(1).max(1000).optional(),
  aiWorth: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  language: z.enum(['EN', 'KO']).optional(),
  sortBy: z.enum(['id', 'title', 'isoDate', 'category', 'status', 'aiWorth']).default('id'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  secondarySortBy: z.enum(['id', 'title', 'isoDate', 'category', 'status', 'aiWorth']).optional(),
  secondarySortOrder: z.enum(['asc', 'desc']).optional(),
});

const mapSortColumn = (key: 'id' | 'title' | 'isoDate' | 'category' | 'status' | 'aiWorth') => {
  if (key === 'isoDate') {
    return 'iso_date';
  }
  if (key === 'aiWorth') {
    return 'ai_worth';
  }
  return key;
};

export const GET = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawEntries = Object.fromEntries(
      Array.from(searchParams.entries()).map(([key, value]) => [key, value || undefined])
    );

    const parsed = querySchema.safeParse(rawEntries);
    if (!parsed.success) {
      return handleRouteError(parsed.error);
    }

    const query = parsed.data;
    const from = (query.page - 1) * query.limit;
    const to = from + query.limit - 1;

    // 构建 Supabase 查询
    let supabaseQuery = supabase.from('news').select('*', { count: 'exact' });

    // 应用过滤条件
    if (query.category) {
      supabaseQuery = supabaseQuery.ilike('category', `%${query.category}%`);
    }
    if (query.status) {
      supabaseQuery = supabaseQuery.eq('status', query.status);
    }
    if (query.title) {
      supabaseQuery = supabaseQuery.ilike('title', `%${query.title}%`);
    }
    if (query.aiWorth !== undefined) {
      supabaseQuery = supabaseQuery.eq('ai_worth', query.aiWorth);
    }
    if (query.language === 'EN') {
      supabaseQuery = supabaseQuery
        .not('title-en', 'is', null)
        .neq('title-en', '');
    } else if (query.language === 'KO') {
      supabaseQuery = supabaseQuery
        .not('title-ko', 'is', null)
        .neq('title-ko', '');
    }

    // 排序
    const sortColumn = mapSortColumn(query.sortBy);
    supabaseQuery = supabaseQuery.order(sortColumn, { ascending: query.sortOrder === 'asc' });

    if (query.secondarySortBy) {
      const secondaryColumn = mapSortColumn(query.secondarySortBy);
      const secondaryAscending = (query.secondarySortOrder ?? query.sortOrder) === 'asc';
      supabaseQuery = supabaseQuery.order(secondaryColumn, { ascending: secondaryAscending });
    }

    // 分页
    supabaseQuery = supabaseQuery.range(from, to);

    const { data: news, error, count: total } = await supabaseQuery;

    if (error) {
      throw error;
    }

    const totalPages = query.limit > 0 && total ? Math.ceil(total / query.limit) : 0;

    return successResponse({
      news: serializeNewsList(news || []),
      pagination: {
        current: query.page,
        total: totalPages,
        count: news?.length || 0,
        totalCount: total || 0,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
};
