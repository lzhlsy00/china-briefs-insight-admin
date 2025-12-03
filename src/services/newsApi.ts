import {
  NewsListResponse,
  NewsItem,
  NewsListParams,
  NewsUpdateData,
  NewsUploadData,
  BaseResponse,
  StatsResponse,
  NewsCreatePayload,
  HeroImageUploadRequest,
  HeroImageUploadResponse,
} from '../types/api';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '/api/v1').replace(/\/$/, '');

type QueryParamValue = string | number | boolean;

type QueryParams = Record<string, QueryParamValue | null | undefined>;

type ErrorPayload = {
  message?: unknown;
  errors?: Array<{ message?: unknown }> | unknown;
};

const buildQueryString = (params?: QueryParams): string => {
  if (!params) {
    return '';
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    searchParams.append(key, String(value));
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const extractErrorMessage = (payload: unknown): string | undefined => {
  if (payload && typeof payload === 'object') {
    const typed = payload as ErrorPayload;

    if (typeof typed.message === 'string' && typed.message.trim().length > 0) {
      return typed.message;
    }

    if (Array.isArray(typed.errors)) {
      const messages = typed.errors
        .map((item) => (item && typeof item === 'object' ? (item as { message?: unknown }).message : undefined))
        .filter((message): message is string => typeof message === 'string' && message.trim().length > 0);

      if (messages.length > 0) {
        return messages.join(', ');
      }
    }
  }

  return undefined;
};

const apiClient = {
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    console.log(`API请求: ${config.method || 'GET'} ${url}`);

    try {
      const response = await fetch(url, config);
      const payload = await parseResponseBody(response);

      console.log(`API响应: ${response.status} ${url}`);

      if (!response.ok) {
        const message = extractErrorMessage(payload) ?? `HTTP ${response.status}`;
        throw new Error(message);
      }

      return payload as T;
    } catch (error) {
      console.error('API请求失败:', error);
      throw error;
    }
  },

  async get<T>(endpoint: string, params?: QueryParams): Promise<T> {
    const query = buildQueryString(params);
    const url = query ? `${endpoint}${query}` : endpoint;
    return this.request<T>(url);
  },

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  },

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  },

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  },
};

export const newsApi = {
  getNewsList: async (params: NewsListParams = {}): Promise<NewsListResponse> => {
    return apiClient.get<NewsListResponse>('/admin/news', params);
  },

  getNewsById: async (id: number): Promise<BaseResponse<NewsItem>> => {
    return apiClient.get<BaseResponse<NewsItem>>(`/admin/news/${id}`);
  },

  updateNews: async (id: number, data: NewsUpdateData): Promise<BaseResponse<NewsItem>> => {
    return apiClient.put<BaseResponse<NewsItem>>(`/admin/news/${id}`, data);
  },

  createNews: async (data: NewsCreatePayload): Promise<BaseResponse<NewsItem>> => {
    return apiClient.post<BaseResponse<NewsItem>>('/admin/news', data);
  },

  deleteNews: async (id: number): Promise<BaseResponse<{ id: number }>> => {
    return apiClient.delete<BaseResponse<{ id: number }>>(`/admin/news/${id}`);
  },

  getStats: async (): Promise<StatsResponse> => {
    return apiClient.get<StatsResponse>('/admin/stats');
  },

  uploadNews: async (data: NewsUploadData): Promise<BaseResponse<NewsItem>> => {
    return apiClient.post<BaseResponse<NewsItem>>('/upload', data);
  },

  getHeroImageUploadUrl: async (data: HeroImageUploadRequest): Promise<BaseResponse<HeroImageUploadResponse>> => {
    return apiClient.post<BaseResponse<HeroImageUploadResponse>>('/uploads/news-hero-image', data);
  },
};

export const handleApiError = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const typedError = error as {
      response?: { data?: unknown };
      message?: unknown;
    };

    const responseMessage = extractErrorMessage(typedError.response?.data);
    if (responseMessage) {
      return responseMessage;
    }

    if (typeof typedError.message === 'string' && typedError.message.trim().length > 0) {
      return typedError.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知错误';
};
