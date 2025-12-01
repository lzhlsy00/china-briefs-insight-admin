// 基础响应类型
export interface BaseResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

// 新闻相关类型
export interface NewsItem {
  id: number;
  title: string;
  isoDate: string;
  link: string;
  content: string | null;
  aiWorth: boolean | null;
  aiReason: string | null;
  category: string | null;
  categoryEn?: string | null;
  categoryKo?: string | null;
  status: 'DRAFT' | 'PUBLISH';
  translationKo: string | null;
  translationEn: string | null;
  titleKo: string | null;
  titleEn: string | null;
  aiReasonEn?: string | null;
  aiReasonKo?: string | null;
}

// 分页信息
export interface PaginationInfo {
  current: number;
  total: number;
  count: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 新闻列表响应
export interface NewsListResponse extends BaseResponse {
  data: {
    news: NewsItem[];
    pagination: PaginationInfo;
  };
}

// 统计信息响应
export interface StatsResponse extends BaseResponse {
  data: {
    total: number;
    status: {
      draft: number;
      published: number;
    };
    aiWorth: {
      true: number;
      false: number;
      null: number;
    };
    categories: Array<{
      name: string;
      count: number;
    }>;
  };
}

// 请求参数类型
export interface NewsListParams extends Record<string, string | number | boolean | null | undefined> {
  page?: number;
  limit?: number;
  category?: string;
  status?: 'DRAFT' | 'PUBLISH';
  title?: string;
  aiWorth?: boolean;
  language?: 'EN' | 'KO';
  sortBy?: 'id' | 'title' | 'isoDate' | 'category' | 'status' | 'aiWorth';
  sortOrder?: 'asc' | 'desc';
  secondarySortBy?: 'id' | 'title' | 'isoDate' | 'category' | 'status' | 'aiWorth';
  secondarySortOrder?: 'asc' | 'desc';
}

export interface NewsUpdateData {
  title?: string;
  isoDate?: string;
  link?: string;
  content?: string;
  aiWorth?: boolean;
  aiReason?: string;
  category?: string;
  status?: 'DRAFT' | 'PUBLISH';
  translationKo?: string | null;
  translationEn?: string | null;
  titleKo?: string | null;
  titleEn?: string | null;
}

export interface NewsUploadData {
  title: string;
  isoDate: string;
  link: string;
  content?: string;
  aiWorth?: boolean;
  aiReason?: string;
  category?: string;
  status?: 'DRAFT' | 'PUBLISH';
  translationKo?: string | null;
  translationEn?: string | null;
  titleKo?: string | null;
  titleEn?: string | null;
}

export interface NewsCreatePayload {
  isoDate: string;
  status: 'DRAFT' | 'PUBLISH';
  aiWorth: boolean;
  primaryLanguage: 'EN' | 'KO';
  titleEn?: string;
  titleKo?: string;
  contentEn?: string;
  contentKo?: string;
  categoryEn?: string;
  categoryKo?: string;
  aiReasonEn?: string;
  aiReasonKo?: string;
}
