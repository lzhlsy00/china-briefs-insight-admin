import { curateTopNews } from '@/lib/ai/newsCurator';
import { handleRouteError } from '@/lib/api/error';
import { successResponse } from '@/lib/api/response';
import { supabase } from '@/lib/supabase';

const NEWS_FETCH_LIMIT = 10;
const DIGEST_TITLE_PREFIX = 'BiteChina 日报';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const formatDigest = (
  items: Array<{ title: string; summary: string; link: string }>
): string => {
  return items
    .map((item, index) => {
      const safeTitle = item.title.trim();
      const safeSummary = item.summary.trim();
      const lines = [
        `🔹${index + 1}. ${safeTitle}`,
        safeSummary,
        item.link ? ` 👉 Full article: ${item.link}` : ' 👉 Full article',
      ];
      return lines.join('\n');
    })
    .join('\n\n');
};

type NewsRow = {
  id: number;
  title: string;
  link: string;
  content: string | null;
  ai_reason: string | null;
  category: string | null;
};

export const POST = async () => {
  try {
    const { data: rows, error } = await supabase
      .from('news')
      .select('id, title, link, content, ai_reason, category')
      .or('status.eq.PUBLISH,status.eq.publish')
      .order('iso_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(NEWS_FETCH_LIMIT);

    if (error) {
      throw error;
    }

    const news = (rows as NewsRow[] | null) ?? [];

    if (news.length === 0) {
      return successResponse(
        { created: false, reason: 'no-news' },
        { status: 200, message: '没有可用的发布新闻' }
      );
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
      return successResponse(
        { created: false, reason: 'no-selection' },
        { status: 200, message: '未生成推送内容' }
      );
    }

    const digestContent = formatDigest(curated);
    const now = new Date();
    const digestTitle = `${DIGEST_TITLE_PREFIX} - ${now.toLocaleDateString('zh-CN')}`;
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

    return successResponse(
      {
        created: true,
        contentId: inserted?.id,
        date: inserted?.date ?? isoDate,
        published: inserted?.published ?? false,
        items: curated,
      },
      { status: 201, message: '推送内容已生成' }
    );
  } catch (error) {
    return handleRouteError(error);
  }
};
