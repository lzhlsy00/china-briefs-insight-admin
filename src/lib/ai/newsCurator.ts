import { z } from 'zod';
import { buildNewsPermalink } from '@/lib/newsLinks';

export type SourceNewsItem = {
  id: number;
  slug: string | null;
  title: string;
  link: string;
  content?: string | null;
  aiReason?: string | null;
  category?: string | null;
};

export type CuratedNewsItem = {
  id: number;
  title: string;
  summary: string;
  link: string;
};

const DIGEST_COUNT = 5;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

const OPENAI_BASE_URL = (process.env.OPENAI_API_BASE ?? process.env.OPENAI_BASE_URL)?.replace(/\/$/, '');

const requireOpenAIBaseUrl = () => {
  if (!OPENAI_BASE_URL) {
    throw new Error('OPENAI_BASE_URL 未配置，无法调用模型服务');
  }
  return OPENAI_BASE_URL;
};

const curatedSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(200),
        summary: z.string().min(1).max(500),
      })
    )
    .min(1),
});

const translationSchema = z.object({
  translations: z.array(
    z.object({
      index: z.number().int().min(0),
      field: z.enum(['title', 'summary']),
      text: z.string().min(1),
    })
  ),
});

type PreparedNews = SourceNewsItem & {
  baseSummary: string;
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const containsCJK = (value: string) => /[\u3400-\u9FFF]/.test(value);

const requiresTranslation = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return containsCJK(trimmed) || /[^\u0000-\u007F]/.test(trimmed);
};

const truncate = (value: string, length: number) => {
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length - 1)}…`;
};

const buildBaseSummary = ({ content, aiReason }: SourceNewsItem) => {
  const source = normalizeWhitespace(content ?? aiReason ?? '');
  if (!source) {
    return 'Summary unavailable.';
  }
  return truncate(source, 160);
};

const prepareNews = (news: SourceNewsItem[]): PreparedNews[] => {
  return news.map((item) => ({
    ...item,
    baseSummary: buildBaseSummary(item),
  }));
};

const fallbackSelection = (items: PreparedNews[]): CuratedNewsItem[] => {
  return items.slice(0, Math.min(DIGEST_COUNT, items.length)).map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.baseSummary,
    link: buildNewsPermalink(item.id, item.slug),
  }));
};

const safeParseJson = (raw: string | null | undefined) => {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('AI 响应解析失败，原始内容:', raw);
    console.error(error);
    return null;
  }
};

const buildPrompt = (items: PreparedNews[]) => {
  const limited = items.slice(0, Math.min(10, items.length));
  const payload = limited.map((item, index) => ({
    index: index + 1,
    id: item.id,
    title: item.title,
    category: item.category ?? null,
    link: buildNewsPermalink(item.id, item.slug),
    summary: item.baseSummary,
  }));

  return (
    `You are an experienced China tech and business editor.\n` +
    `From the list, select up to ${Math.min(DIGEST_COUNT, items.length)} stories with the strongest impact.\n` +
    `Respond in English only with JSON in the form {"items":[{"id":number,"title":string,"summary":string}]}.\n` +
    `Translate any non-English material into fluent English.\n` +
    `Write a sharp English headline (max 120 characters) and a 35-60 word English summary that highlights why it matters.\n` +
    `Avoid long quotes and skip near-duplicate stories unless they add new insight.\n` +
    `News list:\n${JSON.stringify(payload, null, 2)}`
  );
};

const translateItemsToEnglish = async (items: CuratedNewsItem[], apiKey: string) => {
  const entries: Array<{ index: number; field: 'title' | 'summary'; text: string }> = [];

  items.forEach((item, index) => {
    if (requiresTranslation(item.title)) {
      entries.push({ index, field: 'title', text: item.title });
    }
    if (requiresTranslation(item.summary)) {
      entries.push({ index, field: 'summary', text: item.summary });
    }
  });

  if (entries.length === 0) {
    return items;
  }

  try {
    const baseUrl = requireOpenAIBaseUrl()
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You translate Chinese or bilingual news copy into concise English fit for a professional briefing.',
          },
          {
            role: 'user',
            content:
              'Translate the following fields into natural English. Return JSON {"translations":[{"index":number,"field":"title"|"summary","text":string}]}. If a field is already fluent English, repeat it without change. ' +
              `Items:\n${JSON.stringify(entries, null, 2)}`,
          },
        ],
        temperature: 0,
        response_format: { type: 'json_object' as const },
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      console.warn('翻译请求失败', response.status, errorPayload);
      return items;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? null;
    const parsed = safeParseJson(content);
    const validated = parsed ? translationSchema.safeParse(parsed) : null;

    if (!validated || !validated.success) {
      if (validated && !validated.success) {
        console.warn('翻译结果结构异常', validated.error.format());
      }
      return items;
    }

    const updated = items.map((item) => ({ ...item }));

    for (const entry of validated.data.translations) {
      const target = updated[entry.index];
      if (!target) {
        continue;
      }
      if (entry.field === 'title') {
        target.title = entry.text;
      } else {
        target.summary = entry.text;
      }
    }

    return updated;
  } catch (error) {
    console.error('调用翻译接口失败', error);
    return items;
  }
};

export const curateTopNews = async (news: SourceNewsItem[]): Promise<CuratedNewsItem[]> => {
  if (news.length === 0) {
    return [];
  }

  const prepared = prepareNews(news);
  const limit = Math.min(DIGEST_COUNT, prepared.length);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OPENAI_API_KEY 未设置，使用默认排序的前五条新闻');
    const fallback = fallbackSelection(prepared);
    return fallback.map((item) => ({
      id: item.id,
      title: normalizeWhitespace(item.title) || `Story ${item.id}`,
      summary:
        normalizeWhitespace(item.summary) || 'Summary pending translation. Please review the full article on BiteChina.',
      link: item.link,
    }));
  }

  const body = {
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You edit China-focused tech and business news for an English briefing. Your output must be entirely in English, with no Chinese characters.',
      },
      {
        role: 'user',
        content: buildPrompt(prepared),
      },
    ],
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: 'json_object' as const },
  };

  try {
    const baseUrl = requireOpenAIBaseUrl()
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      console.error('OpenAI 响应非 2xx', response.status, errorPayload);
      const fallback = fallbackSelection(prepared);
      return fallback.map((item) => ({
        id: item.id,
        title: normalizeWhitespace(item.title) || `Story ${item.id}`,
        summary:
          normalizeWhitespace(item.summary) || 'Summary pending translation. Please review the full article on BiteChina.',
        link: item.link,
      }));
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? null;
    const parsed = safeParseJson(content);
    const validated = parsed ? curatedSchema.safeParse(parsed) : null;

    let curatedRaw: CuratedNewsItem[];

    if (!validated || !validated.success) {
      if (validated && !validated.success) {
        console.warn('AI 返回数据结构不符合预期', validated.error.format());
      }
      curatedRaw = fallbackSelection(prepared);
    } else {
      const items = validated.data.items.slice(0, limit);
      const preparedMap = new Map(prepared.map((item) => [item.id, item]));

      const collected: CuratedNewsItem[] = [];

      for (const item of items) {
        const source = preparedMap.get(item.id);
        if (!source) {
          continue;
        }

        const rawSummary = normalizeWhitespace(item.summary || '') || source.baseSummary;
        const rawTitle = normalizeWhitespace(item.title || '') || source.title;

        collected.push({
          id: source.id,
          title: rawTitle,
          summary: rawSummary,
          link: buildNewsPermalink(source.id, source.slug),
        });

        if (collected.length >= limit) {
          break;
        }
      }

      if (collected.length < limit) {
        const remaining = prepared.filter((item) => !collected.some((cur) => cur.id === item.id));
        collected.push(...fallbackSelection(remaining).slice(0, limit - collected.length));
      }

      curatedRaw = collected.slice(0, limit);
    }

    const translated = await translateItemsToEnglish(curatedRaw, apiKey);

    return translated.map((item) => {
      const normalizedTitle = normalizeWhitespace(item.title);
      const normalizedSummary = normalizeWhitespace(item.summary);

      const safeTitle = requiresTranslation(normalizedTitle) ? `Story ${item.id}` : normalizedTitle || `Story ${item.id}`;
      const safeSummary = requiresTranslation(normalizedSummary)
        ? 'Summary pending translation. Please review the full article on BiteChina.'
        : normalizedSummary || 'Summary unavailable.';

      return {
        id: item.id,
        title: truncate(safeTitle, 120),
        summary: truncate(safeSummary, 200),
        link: item.link,
      };
    });
  } catch (error) {
    console.error('调用 OpenAI 失败', error);
    const fallback = fallbackSelection(prepared);
    return fallback.map((item) => ({
      id: item.id,
      title: normalizeWhitespace(item.title) || `Story ${item.id}`,
      summary:
        normalizeWhitespace(item.summary) || 'Summary pending translation. Please review the full article on BiteChina.',
      link: item.link,
    }));
  }
};
