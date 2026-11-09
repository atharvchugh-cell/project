import { useState } from 'react';
import { Sparkles, Loader2, Award, TrendingUp, AlertTriangle, RefreshCw, Lightbulb, GitBranch, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { invokeAI } from '@/lib/aiInvoke';

interface AssetSummary {
  ticker: string;
  name: string;
  totalReturn: number;
  finalShares: number;
  finalValueUsd: number;
  allocationPct: number;
  maxAllocationPct?: number;
  bought?: boolean;
  sold?: boolean;
  heldToEndReturnPct?: number;
}

interface YearPoint { year: number; portfolioValue: number; changePct: number; }

interface DecisionQualityBreakdown { category: string; score: number; note: string; }

export interface AnalyzePayload {
  mode: 'stock' | 'real-estate' | 'hard';
  startYear: number;
  endYear: number;
  durationYears: number;
  totalContributed: number;
  finalPortfolio: number;
  totalReturnPct: number;
  cashLeftover: number;
  cashPctOfFinal: number;
  sp500Benchmark?: number;
  goldBenchmark?: number;
  bestAsset?: { ticker: string; name: string; totalReturn: number };
  worstAsset?: { ticker: string; name: string; totalReturn: number };
  bestYear?: { year: number; changePct: number };
  worstYear?: { year: number; changePct: number };
  maxDrawdownPct?: number;
  peakConcentrationPct?: number;
  perfectHindsightFinal?: number;
  perfectHindsightAsset?: { ticker: string; name: string };
  yearly?: YearPoint[];
  assets: AssetSummary[];
  tradeCount?: number;
  decisionQuality?: { score: number; letter: string; breakdown: DecisionQualityBreakdown[] };
}

interface Feedback {
  overall: string;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  strengths: { title: string; detail: string }[];
  improvements: { title: string; detail: string; suggestion: string }[];
  counterfactuals: { moment: string; alternative: string }[];
  pivotalMoments: { year: number; event: string; impact: string }[];
  keyTakeaway: string;
}

interface Props {
  payload: AnalyzePayload;
}

const gradeColors: Record<string, string> = {
  S: 'text-gold border-gold/40 bg-gold/10',
  A: 'text-gain border-gain/40 bg-gain/10',
  B: 'text-gain border-gain/30 bg-gain/5',
  C: 'text-foreground border-border bg-secondary',
  D: 'text-loss border-loss/30 bg-loss/5',
  F: 'text-loss border-loss/40 bg-loss/10',
};

export function AICoachFeedback({ payload }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [tone, setTone] = useState<'coach' | 'blunt' | 'encouraging'>('coach');
  const [focus, setFocus] = useState('');
  const [showFocus, setShowFocus] = useState(false);
  const [requested, setRequested] = useState(false);

  async function analyze(t: 'coach' | 'blunt' | 'encouraging', f: string) {
    setRequested(true);
    setLoading(true);
    setError(null);
    try {
      const data = await invokeAI('analyze-game', { ...payload, tone: t, focus: f || undefined });
      // Backwards compat with old responses that omit new fields
      const d = data as Partial<Feedback>;
      setFeedback({
        overall: d.overall ?? '',
        grade: (d.grade ?? 'C') as Feedback['grade'],
        strengths: d.strengths ?? [],
        improvements: d.improvements ?? [],
        counterfactuals: d.counterfactuals ?? [],
        pivotalMoments: d.pivotalMoments ?? [],
        keyTakeaway: d.keyTakeaway ?? '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate feedback');
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="rounded-lg bg-gradient-to-br from-primary/10 via-card to-card border border-primary/30 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base sm:text-lg">AI Coach Review</h3>
            <p className="text-[11px] text-muted-foreground">Specific, counterfactual analysis of your run</p>
          </div>
        </div>
        {feedback && (
          <div className={`px-3 py-1.5 rounded-lg border-2 font-display font-black text-2xl ${gradeColors[feedback.grade] ?? gradeColors.C}`}>
            {feedback.grade}
          </div>
        )}
      </div>

      {!requested && <div className="space-y-3"><p className="text-sm text-muted-foreground">Requesting a review sends your game statistics and holdings through Lovable’s AI service. Avoid personal information. You may skip this and keep playing.</p><Button onClick={() => analyze(tone, focus)}>Request AI review</Button></div>}
      <p className="text-xs text-muted-foreground mt-3">AI-generated feedback may be wrong. Virtual money only; no real trades or personalized investment advice. <a href="/privacy" className="underline">Privacy</a> · <a href="/methodology" className="underline">Methodology</a></p>
      {loading && (
        <div className="flex items-center gap-3 text-muted-foreground py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm">Analyzing your decisions…</span>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg bg-loss/10 border border-loss/30 p-4 text-sm">
          <div className="font-medium text-loss mb-1">Couldn't generate review</div>
          <div className="text-muted-foreground text-xs mb-3">{error}</div>
          <Button size="sm" variant="outline" onClick={() => analyze(tone, focus)}>
            <RefreshCw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {feedback && !loading && (
        <div className="space-y-5 animate-fade-in">
          <p className="text-sm sm:text-base text-foreground/90 leading-relaxed italic">
            "{feedback.overall}"
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-gain" />
                <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-gain">What You Did Well</h4>
              </div>
              {feedback.strengths.map((s, i) => (
                <div key={i} className="rounded-md bg-gain/5 border border-gain/20 p-3">
                  <div className="font-medium text-sm mb-1 flex items-start gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-gain mt-0.5 shrink-0" />
                    <span>{s.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-5">{s.detail}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-loss" />
                <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-loss">What You Could Improve</h4>
              </div>
              {feedback.improvements.map((s, i) => (
                <div key={i} className="rounded-md bg-loss/5 border border-loss/20 p-3">
                  <div className="font-medium text-sm mb-1">{s.title}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{s.detail}</p>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    <span className="font-semibold text-primary">Try next: </span>{s.suggestion}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {feedback.counterfactuals.length > 0 && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="w-4 h-4 text-accent" />
                <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-accent">What If…</h4>
              </div>
              <ul className="space-y-3">
                {feedback.counterfactuals.map((c, i) => (
                  <li key={i} className="text-xs sm:text-sm leading-relaxed">
                    <span className="text-muted-foreground">{c.moment} </span>
                    <span className="text-foreground">→ {c.alternative}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feedback.pivotalMoments.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-primary" />
                <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-primary">Pivotal Moments</h4>
              </div>
              <ol className="space-y-3">
                {feedback.pivotalMoments.map((p, i) => (
                  <li key={i} className="flex gap-3 text-xs sm:text-sm">
                    <span className="font-mono font-bold text-primary shrink-0 w-12">{p.year}</span>
                    <div>
                      <div className="text-foreground">{p.event}</div>
                      <div className="text-muted-foreground mt-0.5">{p.impact}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="rounded-md bg-primary/10 border border-primary/30 p-3 flex gap-2">
            <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm font-medium">{feedback.keyTakeaway}</p>
          </div>

          {/* Customization */}
          <div className="pt-3 border-t border-border/50 space-y-3">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-muted-foreground">Tone:</span>
              {(['coach', 'blunt', 'encouraging'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTone(t); analyze(t, focus); }}
                  className={`px-2.5 py-1 rounded-md border transition-colors capitalize ${
                    tone === t ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border hover:border-primary/30 text-muted-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() => setShowFocus(v => !v)}
                className="ml-auto text-primary hover:underline"
              >
                {showFocus ? 'Hide' : 'Ask about something specific'}
              </button>
            </div>
            {showFocus && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={focus}
                  onChange={e => setFocus(e.target.value)}
                  placeholder='e.g. "Was I too concentrated in tech?"'
                  className="flex-1 bg-secondary border border-border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  maxLength={200}
                />
                <Button size="sm" onClick={() => analyze(tone, focus)} disabled={!focus.trim()}>
                  <Sparkles className="w-3 h-3 mr-1" /> Regenerate
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
