'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Send, Loader2, ArrowLeft, PenLine } from 'lucide-react';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { AuthShell, authInputClass, authPlainInputClass, authButtonClass, authIconClass } from '@/components/AuthShell';
import { cn } from '@/lib/utils';

export default function DMCAPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    claimantName: '',
    email: '',
    address: '',
    phone: '',
    copyrightedWork: '',
    infringingUrls: '',
    goodFaithStatement: false,
    perjuryStatement: false,
    electronicSignature: '',
    additionalInfo: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.claimantName || !formData.email || !formData.copyrightedWork || !formData.infringingUrls) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!formData.goodFaithStatement || !formData.perjuryStatement) {
      setError('You must agree to both statements to submit a DMCA notice.');
      return;
    }

    if (!formData.electronicSignature) {
      setError('Please provide your electronic signature.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/dmca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit DMCA request');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit DMCA request');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (id: keyof typeof formData) => ({
    id,
    value: formData[id] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, [id]: e.target.value }),
  });
  const label = 'mb-1.5 block text-sm font-medium text-gray-300';
  const optional = <span className="text-gray-500">(optional)</span>;
  const sectionTitle = 'text-xs font-semibold uppercase tracking-wider text-gray-500';

  if (submitted) {
    return (
      <AuthShell title="Request Submitted" subtitle="We'll review your DMCA notice within 24–48 hours.">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
        </div>
        <p className="mb-6 text-center text-sm text-gray-400">
          A confirmation was sent to <strong className="text-white">{formData.email}</strong>.
        </p>
        <Link href="/" className={authButtonClass}>
          <ArrowLeft className="h-4 w-4" />
          Return Home
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      wide
      title="DMCA Takedown Request"
      subtitle={
        <>
          Submit a copyright infringement claim. Questions:{' '}
          <a href="mailto:legal@serika.dev" className="text-violet-400 hover:text-violet-300">legal@serika.dev</a>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Contact Info */}
        <div className="space-y-4">
          <h3 className={sectionTitle}>Your Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="claimantName" className={label}>Full Legal Name *</label>
              <input {...field('claimantName')} placeholder="John Doe" autoComplete="name" className={authPlainInputClass} />
            </div>
            <div>
              <label htmlFor="email" className={label}>Email *</label>
              <input {...field('email')} type="email" placeholder="you@example.com" autoComplete="email" className={authPlainInputClass} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="address" className={label}>Address {optional}</label>
              <input {...field('address')} placeholder="Your mailing address" autoComplete="street-address" className={authPlainInputClass} />
            </div>
            <div>
              <label htmlFor="phone" className={label}>Phone {optional}</label>
              <input {...field('phone')} type="tel" placeholder="+1 (555) 000-0000" autoComplete="tel" className={authPlainInputClass} />
            </div>
          </div>
        </div>

        {/* Copyright Info */}
        <div className="space-y-4">
          <h3 className={sectionTitle}>Copyright Details</h3>
          <div>
            <label htmlFor="copyrightedWork" className={label}>Description of Original Work *</label>
            <textarea
              {...field('copyrightedWork')}
              placeholder="Describe your copyrighted work (artwork, photograph, etc.) and provide links to the original if available."
              className={cn(authPlainInputClass, 'min-h-[100px] resize-y')}
            />
          </div>
          <div>
            <label htmlFor="infringingUrls" className={label}>Infringing URLs *</label>
            <textarea
              {...field('infringingUrls')}
              placeholder={'https://serika.art/image/123456\nhttps://serika.art/image/789012'}
              className={cn(authPlainInputClass, 'min-h-[100px] resize-y font-mono text-sm')}
            />
            <p className="mt-1.5 text-xs text-gray-500">One URL per line</p>
          </div>
          <div>
            <label htmlFor="additionalInfo" className={label}>Additional Information {optional}</label>
            <textarea
              {...field('additionalInfo')}
              placeholder="Any other relevant details..."
              className={cn(authPlainInputClass, 'min-h-[80px] resize-y')}
            />
          </div>
        </div>

        {/* Statements */}
        <div className="space-y-3">
          <h3 className={sectionTitle}>Legal Statements</h3>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#2f2b3a]/50 bg-[#111114] p-4 transition-colors hover:border-violet-500/40">
            <Checkbox
              id="goodFaithStatement"
              checked={formData.goodFaithStatement}
              onCheckedChange={(checked) => setFormData({ ...formData, goodFaithStatement: checked as boolean })}
              className="mt-0.5 rounded-[4px] border-gray-600"
            />
            <span className="text-sm leading-relaxed text-gray-300">
              I have a good faith belief that use of the material is not authorized by the copyright owner, its agent, or the law. *
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#2f2b3a]/50 bg-[#111114] p-4 transition-colors hover:border-violet-500/40">
            <Checkbox
              id="perjuryStatement"
              checked={formData.perjuryStatement}
              onCheckedChange={(checked) => setFormData({ ...formData, perjuryStatement: checked as boolean })}
              className="mt-0.5 rounded-[4px] border-gray-600"
            />
            <span className="text-sm leading-relaxed text-gray-300">
              I swear, under penalty of perjury, that the information in this notice is accurate and that I am the copyright owner or authorized to act on behalf of the owner. *
            </span>
          </label>
        </div>

        {/* Signature */}
        <div className="relative">
          <label htmlFor="electronicSignature" className={label}>Electronic Signature *</label>
          <div className="relative">
            <div className={authIconClass}><PenLine /></div>
            <input {...field('electronicSignature')} placeholder="Type your full legal name" className={authInputClass} />
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            By typing your name, you are electronically signing this DMCA notice.
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300/90">
          <strong>Warning:</strong> Filing false DMCA claims is a federal offense and may result in legal liability.
        </div>

        <button type="submit" disabled={submitting} className={authButtonClass}>
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit DMCA Request
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
