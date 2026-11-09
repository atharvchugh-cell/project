import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { quarterLabel } from '@/lib/fund/engine';
import { type Career, firmCash } from '@/lib/firm/career';
import { setFounderSalary } from '@/lib/firm/close';
import { parseSalary, quarterEstimate } from '@/lib/firm/plan';
import { firmMoney as money } from './format';

/** Founder salary: validated, effective at the next quarter close, with its effect on firm cash shown before saving. */
export function SalaryControl({ c, setC }: { c: Career; setC: (c: Career) => void }) {
  const [text, setText] = useState(String(c.founderSalaryQ));
  const parsed = parseSalary(text);
  const next = parsed.ok ? parsed.value : c.founderSalaryQ;
  const est = quarterEstimate(c, 1);
  const otherOut = est.firmOutTotal - c.founderSalaryQ;
  const afterFees = firmCash(c) + est.firmInTotal - otherOut;
  const effective = quarterLabel(c.fund, c.fund.q + 1);
  const pending = c.salaryHistory.find(x => x.effectiveQ === c.fund.q + 1);
  const changed = parsed.ok && parsed.value !== c.founderSalaryQ;
  return (
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (parsed.ok) setC(setFounderSalary(c, parsed.value)); }}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm space-y-1">Salary per quarter (dollars)
          <Input inputMode="decimal" value={text} onChange={e => setText(e.target.value)} className="w-48 tabular-nums" aria-invalid={!parsed.ok} aria-describedby="salary-help" />
        </label>
        <Button type="submit" variant="outline" disabled={!changed}>Set salary</Button>
      </div>
      <div id="salary-help" className="text-xs space-y-1">
        {"error" in parsed ? <p className="text-loss">{parsed.error}</p> : <p className="tabular-nums">{money(next)} a quarter = <b>{money(next * 4)}</b> a year. Rounded to the nearest $1,000.</p>}
        <p className="text-muted-foreground">Now {money(c.founderSalaryQ)} a quarter{pending ? ` (changed from ${money(pending.fromQ)})` : ''}. A change takes effect at the {effective} close. Paid after payroll, office and back pay, only if the firm has the cash.</p>
        <p className="text-muted-foreground tabular-nums">Firm cash {money(firmCash(c))}. After estimated fees and other bills this quarter: {money(afterFees)}, so {money(Math.max(0, afterFees - next))} would remain after this salary{afterFees < next ? ', and the salary would be skipped' : ''}.</p>
      </div>
    </form>
  );
}
