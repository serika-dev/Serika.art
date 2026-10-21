// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.AUTOTAG_BACKFILL === 'true') {
    const { startAutotagWorker } = await import('./lib/autotagWorker');
    startAutotagWorker();
  }
}
