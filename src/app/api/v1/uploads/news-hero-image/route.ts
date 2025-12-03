import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { handleRouteError } from '@/lib/api/error';
import { optionsResponse, successResponse } from '@/lib/api/response';

const BUCKET_NAME = 'news_hero_images';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(128),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
});

type UploadInput = z.infer<typeof uploadRequestSchema>;

const extractExtension = (fileName: string, fileType: string) => {
  const directExt = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.') + 1) : '';
  if (directExt) {
    return directExt.toLowerCase();
  }

  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  return mimeMap[fileType] || 'jpg';
};

const buildObjectPath = (input: UploadInput) => {
  const ext = extractExtension(input.fileName, input.fileType);
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${datePrefix}/${randomUUID()}.${ext}`;
};

const ensureImageMime = (fileType: string) => {
  if (!fileType.startsWith('image/')) {
    throw new Error('仅支持上传图片文件');
  }
};

export const dynamic = 'force-dynamic';

export const OPTIONS = () => optionsResponse();

export const POST = async (request: NextRequest) => {
  try {
    const payload = await request.json();
    const input = uploadRequestSchema.parse(payload);
    ensureImageMime(input.fileType);

    const objectPath = buildObjectPath(input);
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(objectPath, { upsert: true });

    if (error || !data) {
      throw error || new Error('生成上传链接失败');
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(objectPath);

    return successResponse({
      path: objectPath,
      uploadUrl: data.signedUrl,
      token: data.token,
      publicUrl: publicUrlData.publicUrl ?? null,
      bucket: BUCKET_NAME,
    });
  } catch (error) {
    return handleRouteError(error);
  }
};
