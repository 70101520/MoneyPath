const secret = process.env.JOB_SECRET ?? '';
if (secret.length < 32) throw new Error('JOB_SECRET must contain at least 32 characters');
const endpoint = process.env.NOTIFICATION_JOB_URL ?? 'http://app:3000/api/jobs/notifications';
const interval = Math.max(900000, Number(process.env.NOTIFICATION_INTERVAL_MS ?? 21600000));
async function run() {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
    console.log(new Date().toISOString(), 'notification delivery completed', body);
  } catch (error) {
    console.error(
      new Date().toISOString(),
      'notification delivery failed',
      error instanceof Error ? error.message : error,
    );
  }
}
await new Promise((resolve) => setTimeout(resolve, 5000));
await run();
setInterval(run, interval);
