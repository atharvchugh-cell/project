import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { quarterLabel } from '@/lib/fund/engine';
import { type Career } from '@/lib/firm/career';
import { scheduleSalary, unscheduleSalary } from '@/lib/firm/close';
import { parseSalary } from '@/lib/firm/plan';
import { firmMoney as money } from './format';

/** Plan future founder pay steps. Each step is paid from firm cash at that quarter's close and appears in the forecast. */
export function SalarySchedule({ c, setC }: { c: Career; setC: (c: Career) => void }) {
  const [ahead, setAhead] = useState(4);
  const [text, setText] = useState(String(c.founderSalaryQ));
  const parsed = parseSalary(text);
  const fromQ = c.fund.q + ahead;
  const valid = parsed.ok && fromQ <= c.fund.quarters;
  return (
    <div className="space-y-3 border-t border-border pt-3 mt-3">
      <p className="text-sm font-medium">Salary schedule</p>
      {c.salarySchedule.length === 0 ? <p className="text-xs text-muted-foreground">No future changes planned.</p> :
        <ul className="text-xs space-y-1">{c.salarySchedule.map(x => <li key={x.fromQ} className="flex items-center justify-between gap-2 tabular-nums"><span>From {quarterLabel(c.fund, x.fromQ)}: {money(x.salaryQ)} a quarter ({money(x.salaryQ * 4)} a year)</span><Button size="sm" variant="ghost" className="h-7" onClick={() => setC(unscheduleSalary(c, x.fromQ))}>Remove</Button></li>)}</ul>}
      <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); if (valid && parsed.ok) setC(scheduleSalary(c, fromQ, parsed.value)); }}>
        <label className="text-xs space-y-1">Starting
          <select className="block h-9 rounded-md border border-input bg-background px-2 text-sm" value={ahead} onChange={e => setAhead(Number(e.target.value))}>
            {[1, 2, 4, 8, 12, 20].filter(k => c.fund.q + k <= c.fund.quarters).map(k => <option key={k} value={k}>{quarterLabel(c.fund, c.fund.q + k)}{k === 1 ? ' (next close)' : ''}</option>)}
          </select></label>
        <label className="text-xs space-y-1">Per quarter (dollars)<Input inputMode="decimal" value={text} onChange={e => setText(e.target.value)} className="w-36 tabular-nums" aria-invalid={!parsed.ok} /></label>
        <Button type="submit" size="sm" variant="outline" disabled={!valid}>Add step</Button>
      </form>
      {"error" in parsed && <p className="text-xs text-loss">{parsed.error}</p>}
      <p className="text-[11px] text-muted-foreground">Each step is paid from firm cash at that close, after payroll and office, and the runway forecast already uses it.</p>
    </div>
  );
}
