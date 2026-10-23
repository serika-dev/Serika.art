// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startHealthMonitor } = await import('./lib/healthMonitor');
  startHealthMonitor();
  {
    const { startSampleWorker } = await import('./lib/sampleWorker');
    startSampleWorker();
  }
  if (process.env.AUTOTAG_BACKFILL === 'true') {
    const { startAutotagWorker } = await import('./lib/autotagWorker');
    startAutotagWorker();
  }
  if (process.env.TAG_UNDERSCORE_MIGRATION === 'true') {
    const { startTagUnderscoreMigration } = await import('./lib/tagUnderscoreMigration');
    startTagUnderscoreMigration();
  }
}
