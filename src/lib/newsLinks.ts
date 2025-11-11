const DEFAULT_SITE_NEWS_BASE_URL = 'https://www.bitechina.com/article';

const stripTrailingSlash = (value: string) => value.replace(/\/$/, '');

const resolveSiteBaseUrl = () => {
  if (typeof window === 'undefined') {
    return stripTrailingSlash(
      process.env.SITE_NEWS_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_NEWS_BASE_URL ?? DEFAULT_SITE_NEWS_BASE_URL
    );
  }
  return stripTrailingSlash(process.env.NEXT_PUBLIC_SITE_NEWS_BASE_URL ?? DEFAULT_SITE_NEWS_BASE_URL);
};

const requireSlug = (slug: string | null | undefined, id: number) => {
  const trimmed = typeof slug === 'string' ? slug.trim() : '';
  if (!trimmed) {
    throw new Error(`新闻 ${id} 缺少 slug，无法生成站内链接`);
  }
  return trimmed;
};

export const buildNewsPermalink = (id: number, slug: string | null | undefined) => {
  const base = resolveSiteBaseUrl();
  return `${base}/${requireSlug(slug, id)}`;
};

export const SITE_NEWS_BASE_URL = resolveSiteBaseUrl();
