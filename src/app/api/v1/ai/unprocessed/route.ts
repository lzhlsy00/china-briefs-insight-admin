import { supabase } from '@/lib/supabase';
import { handleRouteError } from '@/lib/api/error';
import { successResponse } from '@/lib/api/response';
import { serializeNewsList } from '@/lib/api/serializers';

const TAKE_LIMIT = 10;

export const GET = async () => {
  try {
    // 获取待评估的新闻
    const { data: pending, error } = await supabase
      .from('news')
      .select('*')
      .is('ai_worth', null)
      .order('id', { ascending: true })
      .limit(TAKE_LIMIT);

    if (error) {
      throw error;
    }

    if (!pending || pending.length === 0) {
      return successResponse(
        {
          news: [],
          count: 0,
          hasMore: false,
          totalPending: 0,
        },
        { message: '暂无需要AI评估的新闻' }
      );
    }

    // 获取总数
    const { count: totalPending } = await supabase
      .from('news')
      .select('*', { count: 'exact', head: true })  
      .is('ai_worth', null);

    return successResponse(
      {
        news: serializeNewsList(pending),
        count: pending.length,
        totalPending: totalPending || 0,
        hasMore: (totalPending || 0) > TAKE_LIMIT,
      },
      { message: `找到 ${pending.length} 条待评估新闻` }
    );
  } catch (error) {
    return handleRouteError(error);
  }
};
