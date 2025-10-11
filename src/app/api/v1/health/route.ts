import { supabase } from '@/lib/supabase';
import { handleRouteError } from '@/lib/api/error';
import { successResponse } from '@/lib/api/response';

export const GET = async () => {
  try {
    // 测试 Supabase 连接
    const { error } = await supabase
      .from('news')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      throw error;
    }

    return successResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected (Supabase)',
      version: '1.0.0',
    });
  } catch (error) {
    return handleRouteError(error);
  }
};
