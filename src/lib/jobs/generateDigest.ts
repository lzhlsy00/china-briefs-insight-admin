import { curateTopNews } from '@/lib/ai/newsCurator';
import type { SourceNewsItem } from '@/lib/ai/newsCurator';
import { supabase } from '@/lib/supabase';

const NEWS_FETCH_LIMIT = 10;
const DIGEST_TITLE_PREFIX = 'BiteChina Daily Digest';
const DIGEST_LOCALES = ['EN', 'KO'] as const;

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
  newsMap: Map<number, LocalizedNews>
) => {
  const helper = localeHelpers[locale];

  return items
    .map(({ id, link }) => {
      const record = newsMap.get(id);
      if (!record) {
        return null;
      }

      const titleRaw =
        locale === 'EN'
          ? normalize(record.titleEn) || normalize(record.title)
          : normalize(record.titleKo) || normalize(record.title);

      const summaryRaw =
        locale === 'EN'
          ? normalize(record.summaryEn) || normalize(record.summaryKo) || normalize(record.aiReason)
          : normalize(record.summaryKo) || normalize(record.summaryEn) || normalize(record.aiReason);

      return {
        id: record.id,
        title: titleRaw || helper.fallbackTitle(record.id),
        summary: summaryRaw || helper.fallbackSummary,
        link: link || record.link,
      };
    })
    .filter((entry): entry is { id: number; title: string; summary: string; link: string | null } => entry !== null);
};

const formatDigest = (locale: DigestLocale, items: Array<{ id: number; link: string }>, newsMap: Map<number, LocalizedNews>) => {
  const entries = buildLocalizedEntries(locale, items, newsMap);

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

const formatDateForTitle = (value: Date) => {
  return value.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const runDigestGenerationJob = async (): Promise<DigestJobResult> => {
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

  const newsRows = (rows as NewsRow[] | null) ?? [];

  if (newsRows.length === 0) {
    return {
      created: false,
      reason: 'no-news',
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

  for (const locale of DIGEST_LOCALES) {
    const digestContent = formatDigest(
      locale,
      curated.map((item) => ({ id: item.id, link: item.link })),
      newsMap
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
