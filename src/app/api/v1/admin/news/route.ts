import { supabase } from '@/lib/supabase';
import { handleRouteError } from '@/lib/api/error';
import { successResponse } from '@/lib/api/response';
import { serializeNews, serializeNewsList } from '@/lib/api/serializers';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  category: z.string().min(1).max(100).optional(),
  status: z.enum(['DRAFT', 'PUBLISH']).optional(),
  title: z.string().min(1).max(1000).optional(),
  aiWorth: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  language: z.enum(['EN', 'KO']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
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

const isoDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: '新闻日期格式不正确，请使用 ISO8601 格式',
  });

const statusSchema = z.enum(['DRAFT', 'PUBLISH']);

const textField = (limit: number) => z.string().max(limit).optional();

const createSchema = z.object({
  isoDate: isoDateSchema,
  status: statusSchema.default('DRAFT'),
  aiWorth: z.boolean().default(true),
  titleCn: z.string().min(1, '中文标题不能为空').max(1000),
  contentCn: textField(5000),
  categoryCn: textField(100),
  aiReasonCn: textField(2000),
  titleEn: z.string().max(1000).optional(),
  titleKo: z.string().max(1000).optional(),
  contentEn: textField(5000),
  contentKo: textField(5000),
  categoryEn: textField(100),
  categoryKo: textField(100),
  aiReasonEn: textField(2000),
  aiReasonKo: textField(2000),
  heroImageUrl: z
    .string()
    .url('封面图片链接格式不正确，请提供有效URL')
    .max(2048)
    .optional(),
});

type CreateInput = z.infer<typeof createSchema>;

const safeTrim = (value?: string | null) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeCreateInput = (input: CreateInput) => {
  return {
    ...input,
    isoDate: new Date(input.isoDate).toISOString(),
    titleCn: safeTrim(input.titleCn) ?? '',
    contentCn: safeTrim(input.contentCn),
    categoryCn: safeTrim(input.categoryCn),
    aiReasonCn: safeTrim(input.aiReasonCn),
    titleEn: safeTrim(input.titleEn),
    titleKo: safeTrim(input.titleKo),
    contentEn: safeTrim(input.contentEn),
    contentKo: safeTrim(input.contentKo),
    categoryEn: safeTrim(input.categoryEn),
    categoryKo: safeTrim(input.categoryKo),
    aiReasonEn: safeTrim(input.aiReasonEn),
    aiReasonKo: safeTrim(input.aiReasonKo),
    heroImageUrl: safeTrim(input.heroImageUrl),
  } as CreateInput & {
    isoDate: string;
    titleCn: string;
    contentCn: string | null;
    categoryCn: string | null;
    aiReasonCn: string | null;
    titleEn: string | null;
    titleKo: string | null;
    contentEn: string | null;
    contentKo: string | null;
    categoryEn: string | null;
    categoryKo: string | null;
    aiReasonEn: string | null;
    aiReasonKo: string | null;
    heroImageUrl: string | null;
  };
};

const buildManualLink = () => {
  try {
    return `https://manual.fortunenews.local/news/${randomUUID()}`;
  } catch (error) {
    console.warn('生成手动新闻链接失败，使用时间戳降级', error);
    return `https://manual.fortunenews.local/news/${Date.now()}`;
  }
};

const buildCreateData = (input: ReturnType<typeof sanitizeCreateInput>) => {
  const data: Record<string, unknown> = {
    iso_date: input.isoDate,
    status: input.status,
    ai_worth: input.aiWorth,
    title: input.titleCn,
    content: input.contentCn ?? null,
    category: input.categoryCn ?? null,
    ai_reason: input.aiReasonCn ?? null,
    link: buildManualLink(),
  };

  if (input.titleCn) data.title = input.titleCn;
  if (input.titleEn) data['title-en'] = input.titleEn;
  if (input.titleKo) data['title-ko'] = input.titleKo;
  if (input.contentEn) data['translation-en'] = input.contentEn;
  if (input.contentKo) data['translation-ko'] = input.contentKo;
  if (input.categoryEn) data['category-en'] = input.categoryEn;
  if (input.categoryKo) data['category-ko'] = input.categoryKo;
  if (input.aiReasonEn) data.ai_reason_en = input.aiReasonEn;
  if (input.aiReasonKo) data.ai_reason_ko = input.aiReasonKo;
  data.hero_image_url = input.heroImageUrl ?? null;

  return data;
};

type SupabaseNewsRecord = {
  id: number;
  title: string;
  iso_date: string;
  link: string;
  content: string | null;
  ai_worth: boolean | null;
  ai_reason: string | null;
  ai_reason_en: string | null;
  ai_reason_ko: string | null;
  hero_image_url: string | null;
  'translation-ko': string | null;
  'translation-en': string | null;
  'title-ko': string | null;
  'title-en': string | null;
  category: string | null;
  status: string;
};

const PUBLISH_WEBHOOK_URL = process.env.PUBLISH_WEBHOOK_URL || '';

const notifyPublishWebhook = async (news: SupabaseNewsRecord) => {
  if (!PUBLISH_WEBHOOK_URL) {
    return;
  }

  try {
    const response = await fetch(PUBLISH_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: news.id,
        title: news.title,
        isoDate: news.iso_date,
        link: news.link,
        content: news.content,
        category: news.category,
        status: news.status,
        aiWorth: news.ai_worth,
        aiReason: news.ai_reason,
        aiReasonEn: news.ai_reason_en,
        aiReasonKo: news.ai_reason_ko,
        translationKo: news['translation-ko'],
        translationEn: news['translation-en'],
        titleKo: news['title-ko'],
        titleEn: news['title-en'],
        heroImageUrl: news.hero_image_url,
      }),
    });

    if (!response.ok) {
      console.error('发布 webhook 调用失败', response.status);
    }
  } catch (error) {
    console.error('发布 webhook 异常', error);
  }
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
    if (query.dateFrom) {
      supabaseQuery = supabaseQuery.gte('iso_date', query.dateFrom);
    }
    if (query.dateTo) {
      supabaseQuery = supabaseQuery.lte('iso_date', query.dateTo);
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

export const POST = async (request: NextRequest) => {
  try {
    const payload = await request.json();
    const parsed = createSchema.parse(payload);
    const sanitized = sanitizeCreateInput(parsed);
    const insertData = buildCreateData(sanitized);

    const { data: created, error } = await supabase
      .from('news')
      .insert(insertData)
      .select('*')
      .single();

    if (error || !created) {
      throw error || new Error('创建新闻失败');
    }

    await notifyPublishWebhook(created as SupabaseNewsRecord);

    return successResponse(serializeNews(created), { status: 201, message: '新闻创建成功' });
  } catch (error) {
    return handleRouteError(error);
  }
};
