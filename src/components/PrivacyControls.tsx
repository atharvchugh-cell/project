import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { analyticsAllowed, privacyChoice, PRIVACY_EVENT, savePrivacyChoice } from '@/lib/privacy';

export function PrivacyControls() {
  const [choice, setChoice] = useState(privacyChoice);
  const [open, setOpen] = useState(false);
  const [allowed, setAllowed] = useState(analyticsAllowed);
  useEffect(() => {
    const update = () => { setChoice(privacyChoice()); setAllowed(analyticsAllowed()); };
    window.addEventListener(PRIVACY_EVENT, update);
    return () => window.removeEventListener(PRIVACY_EVENT, update);
  }, []);
  const save = (value: boolean) => { savePrivacyChoice(value); setOpen(false); };
  return <>
    <nav aria-label="Legal and privacy" className="border-t border-border bg-background px-4 py-5 flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">
      <Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies">Cookies & storage</Link><Link to="/contact">Contact</Link>
      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => { setAllowed(analyticsAllowed()); setOpen(true); }}>Privacy settings</Button>
    </nav>
    {!choice && <aside aria-label="Optional analytics choices" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-lg border border-border bg-card p-4 shadow-lg">
      <p className="text-sm font-semibold">Your privacy choices</p>
      <p className="mt-1 text-xs text-muted-foreground">Necessary storage supports sign-in, requested saves, rooms and abuse protection. Optional game and tutorial analytics stay off unless you accept. Rejecting does not stop guest play.</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => save(true)}>Accept optional</Button><Button size="sm" variant="outline" onClick={() => save(false)}>Reject optional</Button><Button size="sm" variant="outline" onClick={() => setOpen(true)}>Customize</Button></div>
    </aside>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Privacy settings</DialogTitle><DialogDescription>Change optional collection without losing saves or access to games.</DialogDescription></DialogHeader>
      <div className="flex justify-between items-center gap-4 py-4"><label htmlFor="optional-analytics" className="text-sm">Optional game and tutorial analytics</label><Switch id="optional-analytics" checked={allowed} onCheckedChange={setAllowed} /></div>
      <p className="text-xs text-muted-foreground">Withdrawal stops future optional events. Requested score submissions, rooms and AI are separate services. <Link to="/cookies" className="underline">Storage details</Link></p>
      <Button onClick={() => save(allowed)}>Save privacy choices</Button>
    </DialogContent></Dialog>
  </>;
}