import { supabase } from '@/lib/supabase';
import { handleRouteError } from '@/lib/api/error';
import { successResponse } from '@/lib/api/response';
import { serializeNews, serializeNewsList } from '@/lib/api/serializers';
import { translateNewsFields } from '@/lib/ai/newsTranslator';
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

const languageSchema = z.enum(['EN', 'KO']);

const textField = (limit: number) => z.string().max(limit).optional();

const createSchema = z
  .object({
    isoDate: isoDateSchema,
    status: statusSchema.default('DRAFT'),
    aiWorth: z.boolean().default(true),
    primaryLanguage: languageSchema.default('EN'),
    titleEn: z.string().max(1000).optional(),
    titleKo: z.string().max(1000).optional(),
    contentEn: textField(5000),
    contentKo: textField(5000),
    categoryEn: textField(100),
    categoryKo: textField(100),
    aiReasonEn: textField(2000),
    aiReasonKo: textField(2000),
  })
  .refine(
    (value) => {
      const hasEn = typeof value.titleEn === 'string' && value.titleEn.trim().length > 0;
      const hasKo = typeof value.titleKo === 'string' && value.titleKo.trim().length > 0;
      return hasEn || hasKo;
    },
    { message: '请至少填写一个语言版本的标题', path: ['titleEn'] },
  );

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
    titleEn: safeTrim(input.titleEn),
    titleKo: safeTrim(input.titleKo),
    contentEn: safeTrim(input.contentEn),
    contentKo: safeTrim(input.contentKo),
    categoryEn: safeTrim(input.categoryEn),
    categoryKo: safeTrim(input.categoryKo),
    aiReasonEn: safeTrim(input.aiReasonEn),
    aiReasonKo: safeTrim(input.aiReasonKo),
  } as CreateInput & {
    isoDate: string;
    titleEn: string | null;
    titleKo: string | null;
    contentEn: string | null;
    contentKo: string | null;
    categoryEn: string | null;
    categoryKo: string | null;
    aiReasonEn: string | null;
    aiReasonKo: string | null;
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
    title: input.titleEn ?? input.titleKo ?? 'Untitled',
    content: input.contentEn ?? input.contentKo ?? null,
    category: input.categoryEn ?? input.categoryKo ?? null,
    ai_reason: input.aiReasonEn ?? input.aiReasonKo ?? null,
    link: buildManualLink(),
  };

  if (input.titleEn) data['title-en'] = input.titleEn;
  if (input.titleKo) data['title-ko'] = input.titleKo;
  if (input.contentEn) data['translation-en'] = input.contentEn;
  if (input.contentKo) data['translation-ko'] = input.contentKo;
  if (input.categoryEn) data['category-en'] = input.categoryEn;
  if (input.categoryKo) data['category-ko'] = input.categoryKo;
  if (input.aiReasonEn) data.ai_reason_en = input.aiReasonEn;
  if (input.aiReasonKo) data.ai_reason_ko = input.aiReasonKo;

  return data;
};

const applyTranslations = (
  insertData: Record<string, unknown>,
  input: ReturnType<typeof sanitizeCreateInput>,
  translations: Awaited<ReturnType<typeof translateNewsFields>>, 
  targetLanguage: 'EN' | 'KO',
) => {
  if (!translations) {
    return;
  }

  if (targetLanguage === 'KO') {
    if (!input.titleKo && translations.title) {
      insertData['title-ko'] = translations.title;
    }
    if (!input.contentKo && translations.content) {
      insertData['translation-ko'] = translations.content;
    }
    if (!input.categoryKo && translations.category) {
      insertData['category-ko'] = translations.category;
    }
    if (!input.aiReasonKo && translations.aiReason) {
      insertData.ai_reason_ko = translations.aiReason;
    }
  } else {
    if (!input.titleEn && translations.title) {
      insertData['title-en'] = translations.title;
      insertData.title = insertData.title ?? translations.title;
    }
    if (!input.contentEn && translations.content) {
      insertData['translation-en'] = translations.content;
      insertData.content = insertData.content ?? translations.content;
    }
    if (!input.categoryEn && translations.category) {
      insertData['category-en'] = translations.category;
      insertData.category = insertData.category ?? translations.category;
    }
    if (!input.aiReasonEn && translations.aiReason) {
      insertData.ai_reason_en = translations.aiReason;
      insertData.ai_reason = insertData.ai_reason ?? translations.aiReason;
    }
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

    if (sanitized.status === 'PUBLISH') {
      const targetLanguage = sanitized.primaryLanguage === 'EN' ? 'KO' : 'EN';
      const needsTranslation = targetLanguage === 'KO'
        ? !sanitized.titleKo || !sanitized.contentKo || !sanitized.categoryKo || !sanitized.aiReasonKo
        : !sanitized.titleEn || !sanitized.contentEn || !sanitized.categoryEn || !sanitized.aiReasonEn;

      if (needsTranslation) {
        const translations = await translateNewsFields({
          sourceLanguage: sanitized.primaryLanguage,
          targetLanguage,
          fields: {
            title: sanitized.primaryLanguage === 'EN' ? sanitized.titleEn : sanitized.titleKo,
            content: sanitized.primaryLanguage === 'EN' ? sanitized.contentEn : sanitized.contentKo,
            category: sanitized.primaryLanguage === 'EN' ? sanitized.categoryEn : sanitized.categoryKo,
            aiReason: sanitized.primaryLanguage === 'EN' ? sanitized.aiReasonEn : sanitized.aiReasonKo,
          },
        });

        applyTranslations(insertData, sanitized, translations, targetLanguage);
      }
    }

    const { data: created, error } = await supabase
      .from('news')
      .insert(insertData)
      .select('*')
      .single();

    if (error || !created) {
      throw error || new Error('创建新闻失败');
    }

    return successResponse(serializeNews(created), { status: 201, message: '新闻创建成功' });
  } catch (error) {
    return handleRouteError(error);
  }
};
