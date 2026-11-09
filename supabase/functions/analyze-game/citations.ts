// Citation validation for AI game feedback. Every feedback item must cite a
// fact that exists in the game data sent to the model: a known ticker, a year
// inside the run, or a % / $ figure that matches a data value. Items with no
// valid citation, or that mention a year outside the run, are dropped.

type Facts = { tickers: Set<string>; years: Set<number>; numbers: number[] };

export function collectFacts(stats: unknown): Facts {
  const tickers = new Set<string>();
  const years = new Set<number>();
  const numbers: number[] = [];
  const walk = (v: unknown, key = "") => {
    if (v == null) return;
    if (typeof v === "number" && Number.isFinite(v)) {
      numbers.push(Math.abs(v));
      if (/year/i.test(key) && Number.isInteger(v)) years.add(v);
    } else if (typeof v === "string") {
      if (/^(ticker|asset|bestAsset|worstAsset)$/.test(key)) tickers.add(v.trim());
      if (key === "period") {
        const m = v.match(/^(\d{4})-(\d{4})/);
        if (m) for (let y = +m[1]; y <= +m[2]; y++) years.add(y);
      }
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(stats);
  tickers.delete("");
  return { tickers, years, numbers };
}

const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, q: 1e15 };

function matchesNumber(value: number, facts: Facts): boolean {
  return facts.numbers.some((n) => {
    const tol = Math.max(0.6, Math.abs(n) * 0.02);
    return Math.abs(n - value) <= tol;
  });
}

export function isCited(text: string, facts: Facts): boolean {
  if (typeof text !== "string" || !text.trim()) return false;
  // Any 4-digit year outside the run is a hallucination.
  const mentionedYears = [...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((m) => +m[1]);
  if (mentionedYears.some((y) => !facts.years.has(y))) return false;
  if (mentionedYears.length) return true;
  for (const t of facts.tickers) {
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^A-Za-z0-9])${esc}([^A-Za-z0-9]|$)`).test(text)) return true;
  }
  for (const m of text.matchAll(/([+-]?\d[\d,]*(?:\.\d+)?)\s*%/g)) {
    if (matchesNumber(Math.abs(parseFloat(m[1].replace(/,/g, ""))), facts)) return true;
  }
  for (const m of text.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)\s*([kmbtq])?\b/gi)) {
    const v = parseFloat(m[1].replace(/,/g, "")) * (m[2] ? SUFFIX[m[2].toLowerCase()] : 1);
    if (facts.numbers.some((n) => Math.abs(n - v) <= Math.max(1, n * 0.02))) return true;
  }
  return false;
}

export type Feedback = {
  overall: string;
  grade: string;
  strengths: { title: string; detail: string }[];
  improvements: { title: string; detail: string; suggestion: string }[];
  counterfactuals: { moment: string; alternative: string }[];
  pivotalMoments: { year: number; event: string; impact: string }[];
  keyTakeaway: string;
};

/** Returns validated feedback, or null when nothing verifiable remains. */
export function validateFeedback(raw: unknown, stats: unknown): Feedback | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Feedback;
  if (typeof f.overall !== "string" || typeof f.grade !== "string" || typeof f.keyTakeaway !== "string") return null;
  const facts = collectFacts(stats);
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const strengths = arr<Feedback["strengths"][number]>(f.strengths).filter((s) => isCited(s?.detail, facts));
  const improvements = arr<Feedback["improvements"][number]>(f.improvements).filter((s) => isCited(s?.detail, facts));
  const counterfactuals = arr<Feedback["counterfactuals"][number]>(f.counterfactuals).filter(
    (c) => isCited(c?.moment, facts) && isCited(c?.alternative, facts),
  );
  const pivotalMoments = arr<Feedback["pivotalMoments"][number]>(f.pivotalMoments).filter(
    (p) => facts.years.has(p?.year) && isCited(`${p.year} ${p.event ?? ""}`, facts) && isCited(p?.impact, facts),
  );
  if (strengths.length + improvements.length === 0) return null;
  return { ...f, strengths, improvements, counterfactuals, pivotalMoments };
}
