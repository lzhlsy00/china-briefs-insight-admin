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

export const buildNewsPermalink = (id: number) => {
  const base = resolveSiteBaseUrl();
  return `${base}/${id}`;
};

export const SITE_NEWS_BASE_URL = resolveSiteBaseUrl();
