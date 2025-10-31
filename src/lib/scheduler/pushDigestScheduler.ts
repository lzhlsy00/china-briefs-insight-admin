import cron from 'node-cron';

type SchedulerGlobals = typeof globalThis & {
  __pushDigestJobStarted?: boolean;
};

const globalWithScheduler = globalThis as SchedulerGlobals;

const CRON_EXPRESSION = process.env.DAILY_PUSH_CRON ?? '0 18 * * *';
const CRON_TIMEZONE = process.env.DAILY_PUSH_TZ ?? 'Asia/Shanghai';

if (!globalWithScheduler.__pushDigestJobStarted && process.env.NODE_ENV !== 'test') {
  cron.schedule(
    CRON_EXPRESSION,
    async () => {
      try {
        const { runDigestGenerationJob } = await import('@/lib/jobs/generateDigest');
        const result = await runDigestGenerationJob();

        if (!result.created) {
          console.info('[push-digest] skipped', {
            reason: result.reason,
          });
          return;
        }

        console.info('[push-digest] success', {
          contentId: result.contentId,
          usedNewsIds: result.usedNewsIds,
        });
      } catch (error) {
        console.error('[push-digest] failed', error);
      }
    },
    {
      timezone: CRON_TIMEZONE,
    }
  );

  globalWithScheduler.__pushDigestJobStarted = true;
  console.info('[push-digest] daily job scheduled', {
    cron: CRON_EXPRESSION,
    timezone: CRON_TIMEZONE,
  });
}
