import { z } from 'zod';
import { curateTopNews } from '@/lib/ai/newsCurator';
import type { SourceNewsItem } from '@/lib/ai/newsCurator';
import { supabase } from '@/lib/supabase';

const NEWS_FETCH_LIMIT = 10;
const DIGEST_TITLE_PREFIX = 'BiteChina Daily Digest';
const DIGEST_LOCALES = ['EN', 'KO'] as const;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const OPENAI_BASE_URL = (process.env.OPENAI_API_BASE ?? process.env.OPENAI_BASE_URL)?.replace(/\/$/, '');

type DigestLocale = (typeof DIGEST_LOCALES)[number];

type NewsRow = {
  id: number;
  slug: string | null;
  title: string | null;
  link: string | null;
  'title-en': string | null;
  'title-ko': string | null;
  'translation-en': string | null;
  'translation-ko': string | null;
  ai_reason: string | null;
  category: string | null;
};

type TemplateRow = {
  id: number;
  logo: string | null;
  title: string | null;
  subject: string | null;
  content: string | null;
  banner: string | null;
  footer: string | null;
  is_active: boolean | null;
};

const normalize = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? '';
const requireOpenAIBaseUrl = () => {
  if (!OPENAI_BASE_URL) {
    throw new Error('OPENAI_API_BASE 未配置，无法调用翻译服务');
  }
  return OPENAI_BASE_URL;
};

const digestTranslationSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      title: z.string().min(1),
      summary: z.string().min(1),
    })
  ),
});

const localeHelpers: Record<
  DigestLocale,
  {
    fallbackTitle: (id: number) => string;
    fallbackSummary: string;
    callToAction: string;
  }
> = {
  EN: {
    fallbackTitle: (id: number) => `Story ${id}`,
    fallbackSummary: 'Summary pending translation. Please review the full article.',
    callToAction: '👉 Full article',
  },
  KO: {
    fallbackTitle: (id: number) => `스토리 ${id}`,
    fallbackSummary: '요약을 준비 중입니다. 전체 기사를 확인하세요.',
    callToAction: '👉 전체 기사 보기',
  },
};

type LocalizedNews = {
  id: number;
  slug: string | null;
  title: string | null;
  link: string | null;
  titleEn: string | null;
  titleKo: string | null;
  summaryEn: string | null;
  summaryKo: string | null;
  aiReason: string | null;
  category: string | null;
};

const buildLocalizedEntries = (
  locale: DigestLocale,
  items: Array<{ id: number; link: string }>,
  newsMap: Map<number, LocalizedNews>,
  curatedMap: Map<number, { title: string; summary: string }>
) => {
  const helper = localeHelpers[locale];

  return items
    .map(({ id, link }) => {
      const record = newsMap.get(id);
      const curated = curatedMap.get(id);
      if (!record) {
        return null;
      }

      const titleRaw =
        curated?.title ??
        (locale === 'EN'
          ? normalize(record.titleEn) || normalize(record.title)
          : normalize(record.titleKo) || normalize(record.title));

      const summaryRaw =
        curated?.summary ??
        (locale === 'EN'
          ? normalize(record.summaryEn) || normalize(record.summaryKo) || normalize(record.aiReason)
          : normalize(record.summaryKo) || normalize(record.summaryEn) || normalize(record.aiReason));

      return {
        id: record.id,
        title: titleRaw || helper.fallbackTitle(record.id),
        summary: summaryRaw || helper.fallbackSummary,
        link: link || record.link,
      };
    })
    .filter((entry): entry is { id: number; title: string; summary: string; link: string | null } => entry !== null);
};

const formatDigest = (
  locale: DigestLocale,
  items: Array<{ id: number; link: string }>,
  newsMap: Map<number, LocalizedNews>,
  curatedMap: Map<number, { title: string; summary: string }>
) => {
  const entries = buildLocalizedEntries(locale, items, newsMap, curatedMap);

  if (entries.length === 0) {
    return null;
  }

  const helper = localeHelpers[locale];

  return entries
    .map((entry, index) => {
      const lines = [
        `🔹 ${index + 1}. ${entry.title}`,
        entry.summary,
        entry.link ? `${helper.callToAction}: ${entry.link}` : helper.callToAction,
      ];
      return lines.join('\n');
    })
    .join('\n\n');
};

export type DigestJobResult =
  | {
      created: false;
      reason: 'no-news' | 'no-selection';
      digests: [];
      usedNewsIds: [];
    }
  | {
      created: true;
      digests: Array<{
        locale: DigestLocale;
        contentId: number | null;
        date: string;
        published: boolean;
        digestContent: string;
      }>;
      usedNewsIds: number[];
    };

type SuccessfulDigestJobResult = Extract<DigestJobResult, { created: true }>;

type DigestJobOptions = {
  newsIds?: number[];
};

const translateDigestItems = async (
  items: Array<{ id: number; title: string; summary: string }>,
  locale: DigestLocale
) => {
  if (locale !== 'KO') {
    return null;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (!OPENAI_BASE_URL) {
    console.warn('OPENAI_API_BASE 未设置，跳过韩文翻译');
    return null;
  }

  const baseUrl = requireOpenAIBaseUrl();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' as const },
      messages: [
        {
          role: 'system',
          content: 'Translate briefing headlines and summaries into natural Korean suitable for professional newsletters.',
        },
        {
          role: 'user',
          content:
            'Return JSON {"items":[{"id":number,"title":string,"summary":string}]} with fluent Korean translations. Items:\n' +
            JSON.stringify(items, null, 2),
        },
      ],
    }),
  });

  if (!response.ok) {
    console.warn('Digest translation request failed', response.status, await response.text());
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content ?? null;
  if (!content) {
    return null;
  }

  const parsed = (() => {
    try {
      return JSON.parse(content);
    } catch (error) {
      console.warn('Failed to parse translation response', error);
      return null;
    }
  })();

  const validated = parsed ? digestTranslationSchema.safeParse(parsed) : null;
  if (!validated || !validated.success) {
    if (validated && !validated.success) {
      console.warn('Translation schema mismatch', validated.error.format());
    }
    return null;
  }

  const translatedMap = new Map<number, { title: string; summary: string }>();
  for (const entry of validated.data.items) {
    translatedMap.set(entry.id, {
      title: normalize(entry.title),
      summary: normalize(entry.summary),
    });
  }

  return translatedMap;
};

const formatDateForTitle = (value: Date) => {
  return value.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const runDigestGenerationJob = async (options?: DigestJobOptions): Promise<DigestJobResult> => {
  const selectionIds = options?.newsIds?.filter((id) => Number.isFinite(id)) ?? [];
  let newsRows: NewsRow[] = [];

  if (selectionIds.length > 0) {
    const uniqueIds = Array.from(new Set(selectionIds.map((id) => Number(id)))).filter((id) => id > 0);
    if (uniqueIds.length === 0) {
      return {
        created: false,
        reason: 'no-selection',
        digests: [],
        usedNewsIds: [],
      };
    }

    const { data: selectedRows, error } = await supabase
      .from('news')
      .select('id, slug, title, link, "title-en", "title-ko", "translation-en", "translation-ko", ai_reason, category')
      .in('id', uniqueIds);

    if (error) {
      throw error;
    }

    const mapped = new Map((selectedRows as NewsRow[] | null)?.map((row) => [Number(row.id), row]) ?? []);
    newsRows = uniqueIds
      .map((id) => mapped.get(id))
      .filter((row): row is NewsRow => Boolean(row));
  } else {
    const { data: rows, error } = await supabase
      .from('news')
      .select('id, slug, title, link, "title-en", "title-ko", "translation-en", "translation-ko", ai_reason, category')
      .eq('digest_used', false)
      .or('status.eq.PUBLISH,status.eq.publish')
      .order('iso_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(NEWS_FETCH_LIMIT);

    if (error) {
      throw error;
    }

    newsRows = (rows as NewsRow[] | null) ?? [];
  }

  if (newsRows.length === 0) {
    return {
      created: false,
      reason: selectionIds.length > 0 ? 'no-selection' : 'no-news',
      digests: [],
      usedNewsIds: [],
    };
  }

  const localizedNews: LocalizedNews[] = newsRows.map((item) => ({
    id: item.id,
    slug: item.slug ?? null,
    title: item.title ?? null,
    link: item.link ?? null,
    titleEn: (item['title-en'] as string | null) ?? null,
    titleKo: (item['title-ko'] as string | null) ?? null,
    summaryEn: (item['translation-en'] as string | null) ?? null,
    summaryKo: (item['translation-ko'] as string | null) ?? null,
    aiReason: item.ai_reason ?? null,
    category: item.category ?? null,
  }));

  const newsMap = new Map(localizedNews.map((item) => [item.id, item]));

  const newsForCurator: SourceNewsItem[] = [];

  for (const item of localizedNews) {
    const slugValue = typeof item.slug === 'string' ? item.slug.trim() : '';
    if (!slugValue) {
      continue;
    }

    newsForCurator.push({
      id: item.id,
      slug: slugValue,
      title: item.titleEn ?? item.title ?? `Story ${item.id}`,
      link: item.link ?? '',
      content: item.summaryEn ?? item.summaryKo ?? item.aiReason ?? null,
      aiReason: item.aiReason ?? null,
      category: item.category ?? null,
    });
  }
  const curated = await curateTopNews(newsForCurator);

  if (curated.length === 0) {
    return {
      created: false,
      reason: 'no-selection',
      digests: [],
      usedNewsIds: [],
    };
  }

  const fetchTemplate = async (): Promise<TemplateRow | null> => {
    const activeQuery = await supabase
      .from('template')
      .select('id, logo, title, subject, content, banner, footer, is_active')
      .eq('is_active', true)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle<TemplateRow>();

    if (activeQuery.error) {
      throw activeQuery.error;
    }

    if (activeQuery.data) {
      return activeQuery.data;
    }

    const latestQuery = await supabase
      .from('template')
      .select('id, logo, title, subject, content, banner, footer, is_active')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle<TemplateRow>();

    if (latestQuery.error) {
      throw latestQuery.error;
    }

    return latestQuery.data ?? null;
  };

  const template = await fetchTemplate();

  if (!template) {
    throw new Error('No template available for digest generation');
  }

  const now = new Date();
  const digestTitle = `${DIGEST_TITLE_PREFIX} - ${formatDateForTitle(now)}`;
  const isoDate = now.toISOString();
  const nowDate = isoDate.slice(0, 10);

  const applyPlaceholders = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string') {
      return null;
    }

    const replaced = value.replaceAll('{{date}}', nowDate).trim();
    return replaced.length > 0 ? replaced : null;
  };

  const pushTitle = applyPlaceholders(template.title) ?? digestTitle;
  const pushSubject = applyPlaceholders(template.subject) ?? digestTitle;
  const pushLogo = applyPlaceholders(template.logo);
  const pushBanner = applyPlaceholders(template.banner);
  const pushFooter = applyPlaceholders(template.footer);

  const usedNewsIds = curated.map((item) => item.id);

  const digests: SuccessfulDigestJobResult['digests'] = [];
  const curatedMap = new Map(curated.map((item) => [item.id, { title: item.title, summary: item.summary }]));
  const koreanCuratedMap = await translateDigestItems(curated, 'KO');

  for (const locale of DIGEST_LOCALES) {
    const localizedCuratedMap =
      locale === 'KO' && koreanCuratedMap
        ? new Map(
            curated.map((item) => [
              item.id,
              koreanCuratedMap.get(item.id) ?? { title: item.title, summary: item.summary },
            ])
          )
        : curatedMap;

    const digestContent = formatDigest(
      locale,
      curated.map((item) => ({ id: item.id, link: item.link })),
      newsMap,
      localizedCuratedMap
    );

    if (!digestContent) {
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('push_content')
      .insert({
        title: pushTitle,
        subject: pushSubject,
        logo: pushLogo,
        banner: pushBanner,
        footer: pushFooter,
        content: digestContent,
        date: isoDate,
        published: false,
        local: locale,
      })
      .select('id, date, published, local')
      .single();

    if (insertError) {
      throw insertError;
    }

    digests.push({
      locale,
      contentId: inserted?.id ?? null,
      date: inserted?.date ?? isoDate,
      published: inserted?.published ?? false,
      digestContent,
    });
  }

  if (digests.length === 0) {
    return {
      created: false,
      reason: 'no-selection',
      digests: [],
      usedNewsIds: [],
    };
  }

  if (usedNewsIds.length > 0) {
    const { error: updateError } = await supabase
      .from('news')
      .update({ digest_used: true })
      .in('id', usedNewsIds);

    if (updateError) {
      throw updateError;
    }
  }

  return {
    created: true,
    digests,
    usedNewsIds,
  };
};
