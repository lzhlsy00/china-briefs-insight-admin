import cron from 'node-cron';

type SchedulerGlobals = typeof globalThis & {
  __pushDigestJobStarted?: boolean;
};

const globalWithScheduler = globalThis as SchedulerGlobals;

const CRON_EXPRESSION = process.env.DAILY_PUSH_CRON ?? '0 18 * * *';
const CRON_TIMEZONE = process.env.DAILY_PUSH_TZ ?? 'Asia/Shanghai';
const SEND_DIGEST_CRON = process.env.SEND_DIGEST_CRON ?? '10 18 * * *';
const SEND_DIGEST_TIMEZONE = process.env.SEND_DIGEST_TZ ?? CRON_TIMEZONE;

const requestSendDigest = async () => {
  try {
    const endpoint = process.env.SEND_DIGEST_ENDPOINT;
    if (!endpoint) {
      console.warn('[push-digest] SEND_DIGEST_ENDPOINT 未配置，跳过邮件推送');
      return;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SEND_DIGEST_TOKEN
          ? { Authorization: `Bearer ${process.env.SEND_DIGEST_TOKEN}` }
          : {}),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[push-digest] 邮件推送失败', response.status, text);
      return;
    }

    const payload = await response.json().catch(() => null);
    console.info('[push-digest] 邮件推送成功', payload);
  } catch (error) {
    console.error('[push-digest] 邮件推送调用异常', error);
  }
};

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

        for (const digest of result.digests) {
          console.info('[push-digest] success', {
            locale: digest.locale,
            contentId: digest.contentId,
            usedNewsIds: result.usedNewsIds,
          });
        }
      } catch (error) {
        console.error('[push-digest] failed', error);
      }
    },
    {
      timezone: CRON_TIMEZONE,
    }
  );

  cron.schedule(
    SEND_DIGEST_CRON,
    async () => {
      await requestSendDigest();
    },
    {
      timezone: SEND_DIGEST_TIMEZONE,
    }
  );

  globalWithScheduler.__pushDigestJobStarted = true;
  console.info('[push-digest] daily job scheduled', {
    cron: CRON_EXPRESSION,
    timezone: CRON_TIMEZONE,
  });
  console.info('[push-digest] email job scheduled', {
    cron: SEND_DIGEST_CRON,
    timezone: SEND_DIGEST_TIMEZONE,
  });
}
