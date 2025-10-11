import { supabase } from '@/lib/supabase';
import { handleRouteError } from '@/lib/api/error';
import { successResponse } from '@/lib/api/response';

export const GET = async () => {
  try {
    // 使用 Supabase 查询统计数据
    const [
      { count: totalCount },
      { count: draftCount },
      { count: publishedCount },
      { count: aiWorthTrueCount },
      { count: aiWorthFalseCount },
      { data: categoryData },
    ] = await Promise.all([
      supabase.from('news').select('*', { count: 'exact', head: true }),
      supabase.from('news').select('*', { count: 'exact', head: true }).eq('status', 'DRAFT'),
      supabase.from('news').select('*', { count: 'exact', head: true }).eq('status', 'PUBLISH'),
      supabase.from('news').select('*', { count: 'exact', head: true }).eq('ai_worth', true),
      supabase.from('news').select('*', { count: 'exact', head: true }).eq('ai_worth', false),
      supabase.from('news').select('category').not('category', 'is', null),
    ]);

    // 统计分类
    const categoryMap = new Map<string, number>();
    categoryData?.forEach((item) => {
      const category = (item as { category?: string }).category || '未分类';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    const categoryStats = Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    const data = {
      total: totalCount || 0,
      status: {
        draft: draftCount || 0,
        published: publishedCount || 0,
      },
      aiWorth: {
        true: aiWorthTrueCount || 0,
        false: aiWorthFalseCount || 0,
        null: (totalCount || 0) - (aiWorthTrueCount || 0) - (aiWorthFalseCount || 0),
      },
      categories: categoryStats,
    };

    return successResponse(data);
  } catch (error) {
    return handleRouteError(error);
  }
};
