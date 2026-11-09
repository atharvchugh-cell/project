import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Career } from '@/lib/firm/career';
import { rebrand, rebrandCheck, brandVariant, upgradeEmpire } from '@/lib/firm/brand';
import { Logo } from './Logo';
import { firmMoney } from './format';

export function Rebrand({ c, setC, id, name, industry = 'manager' }: { c: Career; setC: (c: Career) => void; id: string; name: string; industry?: string }) {
  const [open, setOpen] = useState(false); const [text, setText] = useState(name); const [variant, setVariant] = useState(brandVariant(c, id));
  const check = rebrandCheck(c, id);
  return <details open={open} onToggle={e => setOpen(e.currentTarget.open)} className="border-t border-border py-3"><summary className="text-sm cursor-pointer min-h-9">Company identity & rebrand</summary><div className="space-y-3 pt-3">
    {!c.empire ? <><p className="text-xs text-muted-foreground">Add saved brands and company-funded rebranding. All current money, investments and history stay unchanged.</p><Button disabled={c.status !== 'running'} onClick={() => setC(upgradeEmpire(c))}>Upgrade this career</Button></> : <>
      <div className="flex flex-wrap items-center gap-4"><Logo id={id} name={name} industry={industry} variant={brandVariant(c, id)} size={52} /><span className="text-xs text-muted-foreground">Current →</span><Logo id={id} name={text || name} industry={industry} variant={variant} size={52} /><span className="text-sm font-medium break-words">{text || name}</span></div>
      <Input aria-label={`New name for ${name}`} maxLength={60} value={text} onChange={e => setText(e.target.value)} />
      <div className="flex gap-3" role="radiogroup" aria-label={`Logo choices for ${name}`}>{[0, 1, 2].map(v => <Button key={v} variant={variant === v ? 'secondary' : 'outline'} className="h-16 w-16 p-2" role="radio" aria-checked={variant === v} aria-label={`Logo variant ${v + 1}`} onClick={() => setVariant(v)}><Logo id={id} name={text || name} industry={industry} variant={v} /></Button>)}</div>
      <p className="text-xs text-muted-foreground">{firmMoney(check.cost)} from {id === 'firm' ? 'firm' : 'this company’s'} cash. {id === 'firm' ? 'Investor offer share +3 points' : 'Revenue +3%'} for the next two quarters. Once every four quarters.</p>
      {check.reason && <p className="text-xs text-loss">{check.reason}</p>}
      <Button disabled={!!check.reason || !text.trim()} onClick={() => { const r = rebrand(c, id, text, variant); if (r.ok) { setC(r.c); setOpen(false); } (r.ok ? toast.success : toast.error)(r.message); }}>Launch rebrand · {firmMoney(check.cost)}</Button>
    </>}
  </div></details>;
}