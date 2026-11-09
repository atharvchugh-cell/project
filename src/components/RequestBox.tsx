import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Lightbulb, Send, Check, MessageSquareReply } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const schema = z.object({
  message: z.string().trim().min(3, 'Tell us a bit more').max(2000, 'Keep it under 2000 characters'),
  contact: z.string().trim().max(200, 'Contact must be under 200 characters').optional(),
});

interface PublicReply {
  id: string;
  message: string;
  status: string;
  admin_reply: string;
  replied_at: string | null;
}

/**
 * Public feature-request box. Submissions are insert-only; only the
 * admin dashboard (server-side verified) can read them back.
 */
export function RequestBox() {
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [publicationConsent, setPublicationConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [replies, setReplies] = useState<PublicReply[]>([]);

  useEffect(() => {
    // Only suggestions the team has answered are public; contact details never are.
    supabase.rpc('get_public_replies', { p_limit: 12 }).then(({ data }) => {
      if (Array.isArray(data)) setReplies(data as PublicReply[]);
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ message, contact: contact || undefined });
    if (!parsed.success) {
      toast({ title: 'Check your request', description: parsed.error.issues[0].message, variant: 'destructive' });
      return;
    }
    setSending(true);
    const { error } = await supabase.from('feature_requests').insert({
      message: parsed.data.message,
      contact: parsed.data.contact ?? null,
      page: window.location.pathname.slice(0, 200),
      status: 'new',
      publication_consent: publicationConsent,
    });
    setSending(false);
    if (error) {
      toast({ title: 'Could not send', description: 'Please try again in a moment.', variant: 'destructive' });
      return;
    }
    setSent(true);
    setMessage('');
    setContact('');
    setPublicationConsent(false);
  };

  return (
    <section id="request" className="border-t border-border/20">
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="text-center mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-primary mb-3 flex items-center justify-center gap-2">
            <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" /> Request a feature
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            Want something added? <span className="italic">Ask.</span>
          </h2>
          <p className="mt-3 text-muted-foreground text-sm">
            A stock, a game mode, a fix — send it over and it lands straight in the dashboard.
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-border/40 bg-card/40 p-6 text-center">
            <Check className="w-6 h-6 text-emerald-400 mx-auto mb-3" aria-hidden="true" />
            <p className="font-display text-lg font-semibold">Request received</p>
            <p className="text-sm text-muted-foreground mt-1">Thanks — it&rsquo;ll be reviewed soon.</p>
            <Button
              type="button"
              onClick={() => setSent(false)}
              className="mt-4 text-xs font-mono uppercase tracking-wider text-primary hover:underline"
            >
              Send another
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-xl border border-border/40 bg-card/40 p-5 space-y-4">
            <div>
              <label htmlFor="request-message" className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Your request
              </label>
              <textarea
                id="request-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={4}
                required
                placeholder="e.g. Add Tesla to Normal mode, or let me pause the simulation"
                className="w-full rounded-lg bg-background/60 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/60 resize-y"
              />
              <p className="text-[10px] font-mono text-muted-foreground/80 mt-1 text-right">{message.length}/2000</p>
            </div>
            <div>
              <label htmlFor="request-contact" className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Contact <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <input
                id="request-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={200}
                placeholder="Email or username, if you want a reply"
                className="w-full rounded-lg bg-background/60 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/60"
              />
            </div>
            <p className="text-xs text-muted-foreground">Your suggestion stays private. Avoid personal information. <Link to="/privacy" className="underline">Privacy notice</Link></p>
            <label htmlFor="request-publication" className="flex items-start gap-3 text-sm text-muted-foreground"><Checkbox id="request-publication" checked={publicationConsent} onCheckedChange={v => setPublicationConsent(v === true)} /><span>Allow a reviewed, redacted summary and reply to appear publicly. Optional.</span></label>
            <Button
              type="submit"
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground font-display font-semibold hover:opacity-95 transition disabled:opacity-60"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              {sending ? 'Sending…' : 'Send request'}
            </Button>
          </form>
        )}

        {replies.length > 0 && (
          <div className="mt-10">
            <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <MessageSquareReply className="w-3.5 h-3.5" aria-hidden="true" /> Answered suggestions
            </h3>
            <ul className="space-y-3">
              {replies.map((r) => (
                <li key={r.id} className="rounded-xl border border-border/40 bg-card/40 p-4">
                  <div className="flex items-start gap-3">
                    <p className="flex-1 text-sm text-foreground whitespace-pre-wrap break-words">{r.message}</p>
                    <span className="shrink-0 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-mono uppercase text-primary">{r.status === 'new' ? 'replied' : r.status}</span>
                  </div>
                  <div className="mt-3 border-l-2 border-primary/50 pl-3">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-primary mb-1">
                      Rise to Riches{r.replied_at ? ` · ${new Date(r.replied_at).toLocaleDateString()}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{r.admin_reply}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export default RequestBox;
