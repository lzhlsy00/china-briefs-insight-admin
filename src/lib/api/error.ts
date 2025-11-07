import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { errorResponse } from './response';

type SupabaseError = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
};

const isSupabaseError = (error: unknown): error is SupabaseError => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as Record<string, unknown>;
  return typeof candidate.code === 'string' && typeof candidate.message === 'string';
};

const extractReferencedTable = (details?: string | null) => {
  if (!details) {
    return null;
  }

  const match = /table\s+"([^"]+)"/i.exec(details);
  return match?.[1] ?? null;
};

export const handleRouteError = (error: unknown) => {
  if (error instanceof ZodError) {
    return errorResponse('数据验证失败', {
      status: 400,
      errors: error.issues.map((issue) => ({
        field: issue.path.join('.') || 'root',
        message: issue.message,
      })),
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return errorResponse('数据已存在，违反唯一约束', { status: 400 });
      case 'P2025':
        return errorResponse('记录未找到', { status: 404 });
      case 'P2003':
        return errorResponse('外键约束失败', { status: 400 });
      case 'P2014':
        return errorResponse('数据关系冲突', { status: 400 });
      default:
        return errorResponse('数据库操作失败', { status: 500 });
    }
  }

  if (isSupabaseError(error)) {
    if (error.code === '23503') {
      const table = extractReferencedTable(error.details);
      const tableLabel = table ? `「${table}」` : '相关';
      return errorResponse(`仍有 ${tableLabel} 记录引用该数据，无法删除`, { status: 409 });
    }

    const message = error.message || '数据库操作失败';
    return errorResponse(message, { status: 500 });
  }

  console.error('Unhandled route error:', error);
  const message = error instanceof Error ? error.message : '服务器内部错误';
  return errorResponse(message, { status: 500 });
};
