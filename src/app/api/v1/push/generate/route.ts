import { handleRouteError } from '@/lib/api/error';
import { successResponse } from '@/lib/api/response';
import { runDigestGenerationJob } from '@/lib/jobs/generateDigest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = async () => {
  try {
    const result = await runDigestGenerationJob();

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
