import { NextRequest, NextResponse } from 'next/server';
import {
  createImportJob,
  getImportJobs,
  getImportJob,
  cancelImportJob,
  startImportWorker,
  resumePausedJobs,
} from '@/lib/importQueue';

// Auto-resume flag - will resume paused jobs on first request after server restart
let hasAutoResumed = false;

async function autoResumeOnStartup() {
  if (!hasAutoResumed) {
    hasAutoResumed = true;
    // Automatically resume any paused jobs when the server starts
    console.log('[IMPORT QUEUE] Checking for paused jobs to auto-resume...');
    await resumePausedJobs();
  }
}

async function checkAdminAuth() {
  try {
    const { getCurrentUser } = await import('@/lib/auth');
    const user = await getCurrentUser();
    if (!user) return null;
    if (user.rank === 'admin' || user.rank === 'owner') return user;
    return null;
  } catch {
    return null;
  }
}

// GET - List all jobs or get a specific job
export async function GET(request: NextRequest) {
  // Auto-resume paused jobs on first request after server restart
  await autoResumeOnStartup();
  
  const user = await checkAdminAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  const action = searchParams.get('action');

  // Resume paused jobs action
  if (action === 'resume') {
    await resumePausedJobs();
    return NextResponse.json({ success: true, message: 'Worker started to resume paused jobs' });
  }

  // Start worker action (useful after deploy)
  if (action === 'start-worker') {
    startImportWorker();
    return NextResponse.json({ success: true, message: 'Worker started' });
  }

  if (jobId) {
    const job = await getImportJob(jobId);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, job });
  }

  const jobs = await getImportJobs(50);
  return NextResponse.json({ success: true, jobs });
}

// POST - Create a new import job
export async function POST(request: NextRequest) {
  const user = await checkAdminAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, query, queries, limit = 100 } = body;

    if (!type || (!query && !queries)) {
      return NextResponse.json(
        { success: false, error: 'Type and query (or queries) are required' },
        { status: 400 }
      );
    }

    // Handle multiple queries (for bulk tag imports)
    if (queries && Array.isArray(queries)) {
      const jobs = [];
      for (const q of queries) {
        if (q.trim()) {
          const job = await createImportJob(type, q.trim(), limit, user.username);
          jobs.push(job);
        }
      }
      return NextResponse.json({
        success: true,
        message: `Created ${jobs.length} import jobs`,
        jobs,
      });
    }

    // Single query
    const job = await createImportJob(type, query, limit, user.username);
    return NextResponse.json({
      success: true,
      message: `Import job created for "${query}"`,
      job,
    });
  } catch (error: any) {
    console.error('Error creating import job:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create job' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel a job
export async function DELETE(request: NextRequest) {
  const user = await checkAdminAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 });
  }

  const cancelled = await cancelImportJob(jobId);
  if (!cancelled) {
    return NextResponse.json(
      { success: false, error: 'Job not found or already completed' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, message: 'Job cancelled' });
}
