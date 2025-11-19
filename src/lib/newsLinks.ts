const DEFAULT_SITE_NEWS_BASE_URL = 'https://www.bitechina.com';

const stripTrailingSlash = (value: string) => value.replace(/\/$/, '');

const resolveSiteBaseUrl = () => {
  if (typeof window === 'undefined') {
    return stripTrailingSlash(
      process.env.SITE_NEWS_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_NEWS_BASE_URL ?? DEFAULT_SITE_NEWS_BASE_URL
    );
  }
  return stripTrailingSlash(process.env.NEXT_PUBLIC_SITE_NEWS_BASE_URL ?? DEFAULT_SITE_NEWS_BASE_URL);
};

const buildSlugFromTitle = (title: string | null | undefined, id: number) => {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (!trimmed) {
    return `story-${id}`;
  }
  const normalized = trimmed.replace(/\s+/g, '-');
  return encodeURIComponent(normalized);
};

const normalizeLocale = (locale?: string | null) => {
  const value = (locale ?? '').toLowerCase();
  return value === 'ko' ? 'ko' : 'en';
};

export const buildNewsPermalink = (options: { id: number; title?: string | null; locale?: string | null }) => {
  const base = resolveSiteBaseUrl();
  const localeSegment = normalizeLocale(options.locale);
  const slug = buildSlugFromTitle(options.title, options.id);
  return `${base}/${localeSegment}/article/${options.id}/${slug}`;
};

export const SITE_NEWS_BASE_URL = resolveSiteBaseUrl();
