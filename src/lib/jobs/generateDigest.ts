import { curateTopNews, type CuratedNewsItem } from '@/lib/ai/newsCurator';
import { supabase } from '@/lib/supabase';

const NEWS_FETCH_LIMIT = 10;
const DIGEST_TITLE_PREFIX = 'BiteChina Daily Digest';

type NewsRow = {
  id: number;
  title: string;
  link: string;
  content: string | null;
  ai_reason: string | null;
  category: string | null;
};

const formatDigest = (
  items: Array<{ title: string; summary: string; link: string }>
): string => {
  return items
    .map((item, index) => {
      const safeTitle = item.title.trim();
      const safeSummary = item.summary.trim();
      const lines = [
        `🔹 ${index + 1}. ${safeTitle}`,
        safeSummary,
        item.link ? ` 👉 Full article: ${item.link}` : ' 👉 Full article',
      ];
      return lines.join('\n');
    })
    .join('\n\n');
};

export type DigestJobResult =
  | {
      created: false;
      reason: 'no-news' | 'no-selection';
      items: [];
      usedNewsIds: [];
    }
  | {
      created: true;
      items: CuratedNewsItem[];
      contentId: number | null;
      date: string;
      published: boolean;
      usedNewsIds: number[];
      digestContent: string;
    };

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
    .select('id, title, link, content, ai_reason, category')
    .eq('digest_used', false)
    .or('status.eq.PUBLISH,status.eq.publish')
    .order('iso_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(NEWS_FETCH_LIMIT);

  if (error) {
    throw error;
  }

  const news = (rows as NewsRow[] | null) ?? [];

  if (news.length === 0) {
    return {
      created: false,
      reason: 'no-news',
      items: [],
      usedNewsIds: [],
    };
  }

  const curated = await curateTopNews(
    news.map((item) => ({
      id: item.id,
      title: item.title,
      link: item.link,
      content: item.content,
      aiReason: item.ai_reason,
      category: item.category,
    }))
  );

  if (curated.length === 0) {
    return {
      created: false,
      reason: 'no-selection',
      items: [],
      usedNewsIds: [],
    };
  }

  const digestContent = formatDigest(curated);
  const now = new Date();
  const digestTitle = `${DIGEST_TITLE_PREFIX} - ${formatDateForTitle(now)}`;
  const isoDate = now.toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from('push_content')
    .insert({
      title: digestTitle,
      content: digestContent,
      date: isoDate,
      published: false,
    })
    .select('id, date, published')
    .single();

  if (insertError) {
    throw insertError;
  }

  const usedNewsIds = curated.map((item) => item.id);

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
    items: curated,
    contentId: inserted?.id ?? null,
    date: inserted?.date ?? isoDate,
    published: inserted?.published ?? false,
    usedNewsIds,
    digestContent,
  };
};
