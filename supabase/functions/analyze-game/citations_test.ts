import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { collectFacts, isCited, validateFeedback } from "./citations.ts";

const stats = {
  period: "1995-2005 (10y)",
  returnPct: 42.5,
  final: 120000,
  topHoldings: [{ ticker: "AAPL", returnPct: 310.2 }],
  yearlyTrajectory: [{ year: 2000, value: 80000, ytdPct: -12.3 }],
};
const facts = collectFacts(stats);

Deno.test("accepts ticker, in-range year, matching % and $", () => {
  assert(isCited("Holding AAPL paid off.", facts));
  assert(isCited("In 2000 you held on.", facts));
  assert(isCited("You returned 42.5% overall.", facts));
  assert(isCited("You finished with $120,000.", facts));
});

Deno.test("rejects uncited text, invented numbers and out-of-range years", () => {
  assertEquals(isCited("Great discipline overall.", facts), false);
  assertEquals(isCited("You returned 99% overall.", facts), false);
  assertEquals(isCited("In 2008 the crash hit AAPL.", facts), false);
});

Deno.test("validateFeedback drops uncited items and fails when nothing verifiable", () => {
  const base = { overall: "x", grade: "B", keyTakeaway: "y", counterfactuals: [], pivotalMoments: [{ year: 2010, event: "e", impact: "42.5%" }] };
  const out = validateFeedback({ ...base, strengths: [{ title: "a", detail: "AAPL +310.2%" }, { title: "b", detail: "Nice job" }], improvements: [] }, stats)!;
  assertEquals(out.strengths.length, 1);
  assertEquals(out.pivotalMoments.length, 0);
  assertEquals(validateFeedback({ ...base, strengths: [{ title: "b", detail: "Nice" }], improvements: [] }, stats), null);
});
