'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Send, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

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

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-lg w-full rounded-2xl border-green-500/20 bg-green-500/5">
          <CardContent className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="h-7 w-7 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Request Submitted</h2>
            <p className="text-muted-foreground mb-6">
              We've received your DMCA takedown request and sent a confirmation to <strong className="text-foreground">{formData.email}</strong>. 
              Our team will review it within 24-48 hours.
            </p>
            <Link href="/">
              <Button variant="outline" className="rounded-xl">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">DMCA Takedown Request</h1>
          <p className="text-muted-foreground">
            Submit a copyright infringement claim. For questions, contact{' '}
            <a href="mailto:legal@serika.dev" className="text-primary hover:underline">legal@serika.dev</a>
          </p>
        </div>

        {/* Form */}
        <Card className="rounded-2xl">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* Contact Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Your Information</h3>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="claimantName">Full Legal Name *</Label>
                    <Input
                      id="claimantName"
                      value={formData.claimantName}
                      onChange={(e) => setFormData({ ...formData, claimantName: e.target.value })}
                      placeholder="John Doe"
                      className="rounded-xl h-11"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="you@example.com"
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="address">Address <span className="text-muted-foreground">(optional)</span></Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Your mailing address"
                      className="rounded-xl h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone <span className="text-muted-foreground">(optional)</span></Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>
              </div>

              {/* Copyright Info */}
              <div className="space-y-4 pt-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Copyright Details</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="copyrightedWork">Description of Original Work *</Label>
                  <Textarea
                    id="copyrightedWork"
                    value={formData.copyrightedWork}
                    onChange={(e) => setFormData({ ...formData, copyrightedWork: e.target.value })}
                    placeholder="Describe your copyrighted work (artwork, photograph, etc.) and provide links to the original if available."
                    className="rounded-xl min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="infringingUrls">Infringing URLs *</Label>
                  <Textarea
                    id="infringingUrls"
                    value={formData.infringingUrls}
                    onChange={(e) => setFormData({ ...formData, infringingUrls: e.target.value })}
                    placeholder="https://serika.art/image/123456&#10;https://serika.art/image/789012"
                    className="rounded-xl min-h-[100px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">One URL per line</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalInfo">Additional Information <span className="text-muted-foreground">(optional)</span></Label>
                  <Textarea
                    id="additionalInfo"
                    value={formData.additionalInfo}
                    onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                    placeholder="Any other relevant details..."
                    className="rounded-xl min-h-[80px]"
                  />
                </div>
              </div>

              {/* Statements */}
              <div className="space-y-4 pt-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Legal Statements</h3>
                
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors">
                    <Checkbox
                      id="goodFaithStatement"
                      checked={formData.goodFaithStatement}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, goodFaithStatement: checked as boolean })
                      }
                      className="mt-0.5"
                    />
                    <span className="text-sm leading-relaxed">
                      I have a good faith belief that use of the material is not authorized by the copyright owner, its agent, or the law. *
                    </span>
                  </label>

                  <label className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors">
                    <Checkbox
                      id="perjuryStatement"
                      checked={formData.perjuryStatement}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, perjuryStatement: checked as boolean })
                      }
                      className="mt-0.5"
                    />
                    <span className="text-sm leading-relaxed">
                      I swear, under penalty of perjury, that the information in this notice is accurate and that I am the copyright owner or authorized to act on behalf of the owner. *
                    </span>
                  </label>
                </div>
              </div>

              {/* Signature */}
              <div className="space-y-2 pt-2">
                <Label htmlFor="electronicSignature">Electronic Signature *</Label>
                <Input
                  id="electronicSignature"
                  value={formData.electronicSignature}
                  onChange={(e) => setFormData({ ...formData, electronicSignature: e.target.value })}
                  placeholder="Type your full legal name"
                  className="rounded-xl h-11"
                />
                <p className="text-xs text-muted-foreground">
                  By typing your name, you are electronically signing this DMCA notice.
                </p>
              </div>

              {/* Warning */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300/90">
                <strong>Warning:</strong> Filing false DMCA claims is a federal offense and may result in legal liability.
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl font-bold text-base"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    Submit DMCA Request
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer note */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Need help? Contact <a href="mailto:legal@serika.dev" className="text-primary hover:underline">legal@serika.dev</a>
        </p>
      </div>
    </div>
  );
}
