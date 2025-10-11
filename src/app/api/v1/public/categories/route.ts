import { supabase } from '@/lib/supabase';
import { handleRouteError } from '@/lib/api/error';
import { successResponse } from '@/lib/api/response';
import { applyCorsHeaders, createCorsPreflightResponse } from '@/lib/api/cors';

export const GET = async (request: Request) => {
  try {
    const { data: categories } = await supabase
      .from('news')
      .select('category')
      .eq('status', 'PUBLISH')
      .not('category', 'is', null);

    // 统计分类
    const categoryMap = new Map<string, number>();
    categories?.forEach((item) => {
      const category = (item as { category?: string }).category || '未分类';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    const data = Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    return applyCorsHeaders(successResponse(data), request);
  } catch (error) {
    return applyCorsHeaders(handleRouteError(error), request);
  }
};

export const OPTIONS = async (request: Request) => createCorsPreflightResponse(request);
