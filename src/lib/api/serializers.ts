// Supabase 返回的 News 类型（snake_case）
type SupabaseNews = {
  id: number;
  title: string;
  iso_date: string;
  link: string;
  content: string | null;
  ai_worth: boolean | null;
  ai_reason: string | null;
  ai_reason_en: string | null;
  ai_reason_ko: string | null;
  'translation-ko': string | null;
  'translation-en': string | null;
  'title-ko': string | null;
  'title-en': string | null;
  category: string | null;
  'category-en'?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

// 序列化后的 News 类型（camelCase）
export type SerializedNews = {
  id: number;
  title: string;
  isoDate: string;
  link: string;
  content: string | null;
  aiWorth: boolean | null;
  aiReason: string | null;
  aiReasonEn: string | null;
  aiReasonKo: string | null;
  translationKo: string | null;
  translationEn: string | null;
  titleKo: string | null;
  titleEn: string | null;
  category: string | null;
  categoryEn?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

// 将 Supabase 的 snake_case 字段转换为 camelCase
export const serializeNews = (news: SupabaseNews): SerializedNews => {
  return {
    id: news.id,
    title: news.title,
    isoDate: news.iso_date,
    link: news.link,
    content: news.content,
    aiWorth: news.ai_worth,
    aiReason: news.ai_reason,
    aiReasonEn: news.ai_reason_en,
    aiReasonKo: news.ai_reason_ko,
    translationKo: news['translation-ko'],
    translationEn: news['translation-en'],
    titleKo: news['title-ko'],
    titleEn: news['title-en'],
    category: news.category,
    categoryEn: news['category-en'] ?? undefined,
    status: news.status,
    createdAt: news.created_at,
    updatedAt: news.updated_at,
  };
};

export const serializeNewsList = (items: SupabaseNews[]): SerializedNews[] => 
  items.map(serializeNews);
