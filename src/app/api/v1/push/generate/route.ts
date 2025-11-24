import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/error';
import { successResponse } from '@/lib/api/response';
import { runDigestGenerationJob } from '@/lib/jobs/generateDigest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  newsIds: z.array(z.number().int().positive()).min(1).optional(),
});

export const POST = async (request: NextRequest) => {
  try {
    let payloadData: unknown = {};
    try {
      payloadData = await request.json();
    } catch {
      payloadData = {};
    }

    const payload = requestSchema.safeParse(payloadData);
    if (!payload.success) {
      return handleRouteError(payload.error);
    }

    const result = await runDigestGenerationJob(payload.data);

    if (!result.created) {
      const message =
        result.reason === 'no-news'
          ? 'No published news available for digest.'
          : 'Digest content was not generated.';

      return successResponse(result, { status: 200, message });
    }

    return successResponse(result, {
      status: 201,
      message: 'Digest content generated successfully.',
    });
  } catch (error) {
    return handleRouteError(error);
  }
};
