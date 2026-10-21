'use client';

import { useState } from 'react';
import { Mail, MessageSquare, AlertCircle, HelpCircle, Send, CheckCircle, User, Tag, Loader2, ChevronDown } from 'lucide-react';
import { AuthShell, authInputClass, authPlainInputClass, authButtonClass, authIconClass } from '@/components/AuthShell';
import { cn } from '@/lib/utils';

const contactReasons = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'abuse', label: 'Report Abuse' },
  { value: 'other', label: 'Other' },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    reason: '',
    subject: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setSubmitted(true);
    } catch {
      setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthShell title="Message Sent!" subtitle="Thanks for reaching out. We usually reply within 24–48 hours.">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setFormData({ name: '', email: '', reason: '', subject: '', message: '' });
          }}
          className={authButtonClass}
        >
          Send Another Message
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Contact Us" subtitle="Questions, feedback or a problem with a post? We'd love to hear from you.">
      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className={authIconClass}><User /></div>
          <input
            id="name"
            placeholder="Your name"
            aria-label="Name"
            autoComplete="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className={authInputClass}
          />
        </div>

        <div className="relative">
          <div className={authIconClass}><Mail /></div>
          <input
            id="email"
            type="email"
            placeholder="Email address"
            aria-label="Email address"
            autoComplete="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            className={authInputClass}
          />
        </div>

        <div className="relative">
          <div className={authIconClass}><HelpCircle /></div>
          <select
            id="reason"
            aria-label="Reason for contact"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            required
            className={cn(authInputClass, 'appearance-none pr-10', !formData.reason && 'text-gray-500')}
          >
            <option value="" disabled>Reason for contact</option>
            {contactReasons.map((reason) => (
              <option key={reason.value} value={reason.value} className="text-white">
                {reason.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>

        <div className="relative">
          <div className={authIconClass}><Tag /></div>
          <input
            id="subject"
            placeholder="Subject"
            aria-label="Subject"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            required
            className={authInputClass}
          />
        </div>

        <textarea
          id="message"
          placeholder="Your message – as much detail as you can"
          aria-label="Message"
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          required
          rows={6}
          className={cn(authPlainInputClass, 'resize-none')}
        />

        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send Message
            </>
          )}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-gray-500">
        <div className="h-px flex-1 bg-white/10" />
        or
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <a
          href="mailto:support@serika.dev"
          className="flex items-center justify-center gap-2 rounded-xl border border-[#2f2b3a]/60 bg-[#111114] px-3 py-3 text-sm font-semibold text-white transition-colors hover:border-violet-500/50"
        >
          <Mail className="h-4 w-4 text-violet-400" />
          Email us
        </a>
        <a
          href="https://discord.gg/5s2zgwn35y"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4752c4]"
        >
          <MessageSquare className="h-4 w-4" />
          Discord
        </a>
      </div>

      <p className="mt-6 text-center text-sm text-gray-400">
        <a className="text-violet-400 hover:text-violet-300" href="https://issues.serika.dev/issues/new?project=serika-art&kind=bug">Report a bug</a>
        {' or '}
        <a className="text-violet-400 hover:text-violet-300" href="https://issues.serika.dev/issues/new?project=serika-art&kind=feature">request a feature</a>
        {' in Serika Issues.'}
      </p>
    </AuthShell>
  );
}
