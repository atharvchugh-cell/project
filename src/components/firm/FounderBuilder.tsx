import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BACKGROUNDS, BACKGROUND_IDS, LOOK_LIMITS, type FounderSetup, type Look, openingCash, loanPayment } from '@/lib/firm/founderSetup';
import { HAIR_TONES, SKIN_TONES } from '@/lib/firm/faces';
import { Portrait } from './Portrait';
import { firmMoney as money } from './format';

const HAIR = ['Short', 'Long', 'Crew cut', 'Bob', 'Curls', 'Shaved', 'Headwrap'];
const FACE = ['Narrow', 'Oval', 'Round'];
const EYES = ['Calm', 'Smiling', 'Wide'];
const OUTFIT = ['Navy suit', 'Steel suit', 'Burgundy suit', 'Olive suit'];

/** Character creation: name, age 25-35, background and a live avatar. `baseCash` shows the background's real opening cash; omit it for upgrades. */
export function FounderBuilder({ value, onChange, baseCash }: { value: FounderSetup; onChange: (v: FounderSetup) => void; baseCash?: number }) {
  const set = (p: Partial<FounderSetup>) => onChange({ ...value, ...p });
  const look = (p: Partial<Look>) => set({ look: { ...value.look, ...p } });
  const Pick = ({ label, k, names }: { label: string; k: keyof typeof LOOK_LIMITS; names?: string[] }) => (
    <div className="space-y-1"><p className="text-xs text-muted-foreground">{label}</p><div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
      {Array.from({ length: LOOK_LIMITS[k] }, (_, i) => <Button key={i} type="button" size="sm" variant="outline" role="radio" aria-checked={value.look[k] === i} aria-label={`${label} ${names?.[i] ?? i + 1}`}
        className={`min-h-9 ${value.look[k] === i ? 'border-primary text-primary' : ''}`} onClick={() => look({ [k]: i } as Partial<Look>)}>
        {k === 'skin' ? <span className="w-4 h-4 rounded-full border border-border" style={{ background: `hsl(${SKIN_TONES[i].h} 40% ${SKIN_TONES[i].l}%)` }} /> : k === 'tone' ? <span className="w-4 h-4 rounded-full border border-border" style={{ background: `hsl(${HAIR_TONES[i] >= 55 ? 42 : 25} 40% ${HAIR_TONES[i]}%)` }} /> : names?.[i] ?? i + 1}
      </Button>)}</div></div>);
  const Toggle = ({ k, label }: { k: 'glasses' | 'beard' | 'earrings'; label: string }) => <Button type="button" size="sm" variant="outline" aria-pressed={value.look[k]} className={value.look[k] ? 'border-primary text-primary' : ''} onClick={() => look({ [k]: !value.look[k] } as Partial<Look>)}>{label}</Button>;
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-[auto_1fr] gap-5 items-start">
        <div className="flex flex-col items-center gap-2"><Portrait seed={7} name={value.name || 'You'} size={132} age={value.age} mood="happy" look={value.look} /><p className="text-xs text-muted-foreground">Age {value.age}</p></div>
        <div className="space-y-3 min-w-0">
          <label className="block space-y-1 text-sm">Your name<Input value={value.name} maxLength={40} onChange={e => set({ name: e.target.value })} /></label>
          <label className="block space-y-1 text-sm">Starting age: {value.age}<input type="range" min={25} max={35} step={1} value={value.age} onChange={e => set({ age: Number(e.target.value) })} className="w-full accent-[hsl(var(--primary))]" aria-label="Starting age" /></label>
          <Pick label="Skin" k="skin" /><Pick label="Hair" k="hair" names={HAIR} /><Pick label="Hair colour" k="tone" />
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3"><Pick label="Face" k="face" names={FACE} /><Pick label="Eyes" k="eyes" names={EYES} /><Pick label="Outfit" k="outfit" names={OUTFIT} /></div>
      <div className="flex flex-wrap gap-2"><Toggle k="glasses" label="Glasses" /><Toggle k="beard" label="Beard" /><Toggle k="earrings" label="Earrings" /></div>
      <div className="space-y-2"><p className="text-sm">Background</p>
        <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Background">{BACKGROUND_IDS.map(b => { const d = BACKGROUNDS[b]; const on = value.background === b;
          return <Button key={b} type="button" variant="outline" role="radio" aria-checked={on} className={`h-auto whitespace-normal block text-left p-3 ${on ? 'border-primary bg-primary/10' : ''}`} onClick={() => set({ background: b })}>
            <p className="font-semibold">{d.label}</p><p className="text-xs text-muted-foreground mt-1">{d.blurb}</p>
            <ul className="text-[11px] mt-2 space-y-0.5 list-disc pl-4">{d.perks.map(x => <li key={x}>{x}</li>)}<li>You already know: {d.contacts.map(x => x.name).join(', ')}</li></ul>
            {baseCash !== undefined && <p className="text-xs text-primary mt-2 tabular-nums">Personal cash {money(openingCash(baseCash, b))}{d.loanQuarters ? ` · loan ${money(loanPayment(baseCash, b))}/qtr` : ''}</p>}
          </Button>; })}</div>
      </div>
    </div>
  );
}
