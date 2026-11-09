// Ownership and endings. The management company has a cap table starting at
// 100% founder. Partners buy in with real cash into the firm (dilution), share
// every distribution pro rata, and vote. Endings (sell the firm, staged IPO,
// retire to a successor) pay the actual equity owner through the journal and
// never touch client assets in the fund. Each terminal action runs once.
import { quarterLabel } from '@/lib/fund/engine';
import { nav, netAssets } from '@/lib/fund/accounting';
import { mulberry32 } from '@/lib/fund/market';
import { type Career, firmCash, founderStake } from './career';
import { post } from './journal';
import { OPERATING } from './plan';
import { assetsValue, lifeOf, personalCash, personalOwed, reputation } from './life';
import { businessDebt, companyCash } from './business';
import { approval, governanceOf, recordVote } from './governance';
import { managerDebt } from './managerLoans';
import { INITIAL_PUBLIC_SHARES, publicDebt } from './publicBook';

export interface Holder { id: string; name: string; pct: number; paid: number; joinedQ: number; employeeId?: string }
export interface Ipo { stage: 'filed' | 'roadshow' | 'listed'; filedQ: number; roadshowQ?: number; listedQ?: number; price?: number; lockupUntilQ?: number; floatPct?: number; preparationFee?: number }
export interface Ending { kind: 'sold' | 'retired' | 'failed' | 'completed' | 'died'; q: number; title: string; story: string[]; numbers: { label: string; value: number }[] }
export interface Ownership { holders: Holder[]; ipo?: Ipo; offerQ: number }

export const SALE_COST = 0.03;
export const IPO_COST = 0.06;
export const VALUATION_MULTIPLE = 8;
export const MAX_PARTNERS = 0.4;

export const ownershipOf = (c: Career): Ownership => c.ownership ?? { holders: [{ id: 'founder', name: 'You', pct: 1, paid: 0, joinedQ: 0 }], offerQ: -99 };
export const founderPct = (c: Career) => ownershipOf(c).holders.find(h => h.id === 'founder')?.pct ?? 0;
const lbl = (c: Career, q: number) => (q > 0 ? quarterLabel(c.fund, q) : 'Opening');

/** Trailing four closes of firm operating cash profit: fees + business revenue - operating costs (founder salary included). */
export function annualProfit(c: Career): number {
  const from = c.fund.q - 3;
  const tx = c.journal.txns.filter(t => t.closeId && Number(t.closeId.match(/:Q(\d+)$/)?.[1]) >= from);
  const inn = tx.filter(t => t.recipient === 'firm' && (t.category === 'fee_receipt' || t.category === 'staff_revenue' || t.category === 'subsidiary_revenue')).reduce((a, t) => a + t.amount, 0);
  const out = tx.filter(t => (t.payer === 'firm' && OPERATING.includes(t.category)) || (t.category === 'rebrand' && c.subsidiaries.some(s => s.id === t.payer))).reduce((a, t) => a + t.amount, 0);
  return inn - out;
}

/** Public earnings multiples use completed net results and managed assets, never client cash as owned equity. */
export function publicValuationDrivers(c: Career) {
  const listed = ownershipOf(c).ipo?.stage === 'listed';
  const h = c.fund.history.slice(-4);
  const valid = h.length === 4 && h.every(x => Number.isFinite(x.ret) && Number.isFinite(x.bench) && x.ret >= -1 && x.bench >= -1);
  const compound = (key: 'ret' | 'bench') => h.reduce((v, x) => v * (1 + x[key]), 1) - 1;
  const netReturn = valid ? compound('ret') : 0;
  const benchmarkReturn = valid ? compound('bench') : 0;
  const edge = netReturn - benchmarkReturn;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const performanceMult = listed && valid ? clamp(1 + netReturn + edge * 2 - h.filter(x => x.latePayment).length * 0.1, 0.5, 1.5) : 1;
  const aum = Math.max(0, netAssets(c.fund.ledger));
  // Economies of scale affect the earnings multiple modestly, not dollar-for-dollar equity.
  const scaleMult = listed ? clamp(1 + Math.log2(Math.max(1, aum) / 1e9) * 0.05, 0.75, 1.25) : 1;
  return { listed, valid, netReturn, benchmarkReturn, edge, aum, performanceMult, scaleMult };
}

/** Consolidated equity: bounded earnings multiple plus company cash minus debt. Internal transfers and loan
 * principal movements remain neutral. Private firms retain their existing multiple; public firms revalue live. */
export function valuation(c: Career) {
  const profit = annualProfit(c);
  const score = reputation(c).score;
  const rep = Number.isFinite(score) ? score : 40;
  const repMult = 0.8 + (rep / 100) * 0.4;
  const drivers = publicValuationDrivers(c);
  const newsMult = c.publicFirm ? 1 + Math.max(-10, Math.min(10, c.publicFirm.sentiment)) * 0.01 : 1;
  const multiple = VALUATION_MULTIPLE * repMult * drivers.performanceMult * drivers.scaleMult * newsMult;
  const operating = Math.max(0, profit) * multiple;
  const firm = firmCash(c);
  const companies = c.subsidiaries.reduce((a, s) => a + companyCash(c, s.id), 0);
  const cash = firm + companies; const debts = c.arrears + businessDebt(c) + managerDebt(c) + publicDebt(c);
  const total = Math.max(0, operating + cash - debts);
  return { profit, repMult, multiple, newsMult, drivers, operating, cash, firm, companies, debts, total, lines: [
    { label: 'Earnings basis: trailing four-quarter profit (fund fees + outside staff services + business revenue - costs and interest)', value: profit },
    { label: `Earnings value at ${multiple.toFixed(2)}x profit (reputation ${repMult.toFixed(2)}x${drivers.listed ? `, performance ${drivers.performanceMult.toFixed(2)}x, managed-asset scale ${drivers.scaleMult.toFixed(2)}x` : ''}; negative profit counts as 0)`, value: operating },
    { label: '+ Firm cash', value: firm }, { label: '+ Cash inside owned companies', value: companies },
    { label: '- Unpaid bills', value: -c.arrears }, { label: '- Business loans', value: -businessDebt(c) }, { label: '- Manager acquisition loans', value: -managerDebt(c) }, { label: '- Public corporate debt', value: -publicDebt(c) }, { label: 'Estimated equity value (100%)', value: total },
  ] };
}

export const founderEquityValue = (c: Career) => (c.ending?.kind === 'sold' ? 0 : valuation(c).total * founderPct(c));

const running = (c: Career) => c.status === 'running' && !c.ending;
type R = { c: Career; ok: boolean; message: string };
const fail = (c: Career, message: string): R => ({ c, ok: false, message });

/** A partner buy-in offer, at most one a year, deterministic per quarter. Price is 90% of the estimated value of the slice. */
export function partnerOffer(c: Career) {
  const o = ownershipOf(c); const partners = o.holders.filter(h => h.id !== 'founder').reduce((a, h) => a + h.pct, 0);
  if (!running(c) || c.fund.q < 4 || c.fund.q - o.offerQ < 4 || partners >= MAX_PARTNERS || o.ipo) return null;
  const r = mulberry32(c.fund.seed * 59 + c.fund.q * 3);
  const star = [...c.roster].sort((a, b) => b.ability - a.ability)[0];
  const pct = Math.min(MAX_PARTNERS - partners, [0.05, 0.1, 0.15][Math.floor(r() * 3)]);
  const v = valuation(c).total;
  if (v <= 0) return null;
  const inside = !!star && r() < 0.6;
  return { id: `partner-${c.fund.q}`, name: inside ? star!.name : ['Harlow Family Office', 'Brightwater Partners', 'Aldine Holdings'][Math.floor(r() * 3)], employeeId: inside ? star!.id : undefined, pct, price: Math.round(v * pct * 0.9 / 1000) * 1000 };
}

/** Sell new firm equity to a partner: cash goes into the firm (financing), every holder is diluted pro rata. */
export function acceptPartner(c: Career): R {
  const off = partnerOffer(c); if (!off) return fail(c, 'There is no partner offer this quarter.');
  const n: Career = structuredClone(c); const o = ownershipOf(n);
  for (const h of o.holders) h.pct *= 1 - off.pct;
  o.holders.push({ id: off.id, name: off.name, pct: off.pct, paid: off.price, joinedQ: n.fund.q, employeeId: off.employeeId });
  o.offerQ = n.fund.q; n.ownership = o;
  const g = governanceOf(n); g.partners[off.id] = { morale: 65, loyalty: off.employeeId ? 70 : 55, lastMetQ: n.fund.q }; n.governance = g;
  post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'external', recipient: 'firm', category: 'equity_sale', amount: off.price, source: `equity:${off.id}`, memo: `${off.name} bought ${(off.pct * 100).toFixed(0)}% of the firm` });
  if (off.employeeId) n.roster = n.roster.map(e => (e.id === off.employeeId ? { ...e, morale: Math.min(100, e.morale + 15) } : e));
  n.notices.push({ q: n.fund.q, from: off.name, subject: 'Welcome aboard', body: `We paid ${Math.round(off.price).toLocaleString('en-US')} dollars into the firm for ${(off.pct * 100).toFixed(0)}%. We share distributions and vote on the big decisions.`, tone: 'good' });
  return { c: n, ok: true, message: `${off.name} bought ${(off.pct * 100).toFixed(0)}%.` };
}
export const declinePartner = (c: Career): Career => ({ ...c, ownership: { ...ownershipOf(c), offerQ: c.fund.q } });

/** Split a distribution by ownership: the founder's share to you, partners' share paid out to them. */
export function postDistribution(n: Career, amount: number, source: string) {
  const o = ownershipOf(n); const you = founderPct(n);
  post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'firm', recipient: 'founder', category: 'distribution', amount: amount * you, source, memo: you < 1 ? `Your ${(you * 100).toFixed(1)}% of a distribution` : 'Distribution from the firm to you' });
  for (const h of o.holders.filter(x => x.id !== 'founder')) post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'firm', recipient: 'external', category: 'partner_distribution', amount: amount * h.pct, source: `${source}:${h.id}`, memo: `${h.name}'s ${(h.pct * 100).toFixed(1)}%` });
}

function museumNumbers(n: Career) {
  const h = n.fund.history; const peak = Math.max(0, ...n.snapshots.map(s => s.aum));
  return [
    { label: 'Net investor return per unit', value: nav(n.fund.ledger) / n.fund.startNav - 1 },
    { label: 'Fund size at the end', value: netAssets(n.fund.ledger) }, { label: 'Peak fund size', value: peak },
    { label: 'Quarters run', value: h.length },
  ];
}

export function end(n: Career, kind: Ending['kind'], title: string, story: string[], extra: { label: string; value: number }[]) {
  n.ending = { kind, q: n.fund.q, title, story, numbers: [...extra, ...museumNumbers(n)] };
  n.status = 'ended';
}

/** Sell some or all of your equity to an outside buyer. Proceeds (after 3% costs) go to you; client money stays in the fund. */
export function sellStake(c: Career, share: number): R {
  if (!running(c)) return fail(c, 'This career has already ended.');
  const you = founderPct(c);
  if (typeof share !== 'number' || !Number.isFinite(share) || !(share > 0) || share > 1) return fail(c, 'Choose how much of your stake to sell.');
  if (you <= 1e-6) return fail(c, 'You have no equity left to sell.');
  const o = ownershipOf(c);
  if (o.ipo?.lockupUntilQ && c.fund.q < o.ipo.lockupUntilQ) return fail(c, `Your shares are locked up until ${lbl(c, o.ipo.lockupUntilQ)}.`);
  const v = valuation(c); const pct = you * share; const gross = v.total * pct;
  if (gross <= 0) return fail(c, 'No buyer will pay for a firm with no operating profit or cash.');
  // Selling control (half or more of your stake) needs the owners' vote under the constitution.
  const vote = share >= 0.5 ? approval(c, 'sale') : null;
  if (vote && !vote.passed) return fail(recordVoted(c, 'Sell the firm', vote), `Owners voted ${(vote.yes * 100).toFixed(0)}% yes; ${(vote.needed * 100).toFixed(0)}% needed.`);
  const n: Career = structuredClone(c); const no = ownershipOf(n);
  if (vote) recordVote(n, 'Sell the firm', vote);
  const src = `sale:${n.fund.q}:${share}`;
  post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'external', recipient: 'founder', category: 'firm_sale', amount: gross, source: src, memo: `Sold ${(pct * 100).toFixed(1)}% of ${n.firmName}` });
  post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'founder', recipient: 'external', category: 'transaction_cost', amount: gross * SALE_COST, source: `${src}:cost`, memo: 'Bankers and lawyers (3%)' });
  const f = no.holders.find(h => h.id === 'founder'); if (!f) return fail(c, 'The founder share register is missing.');
  f.pct -= pct;
  let buyer = no.holders.find(h => h.id === 'buyer');
  if (!buyer) { buyer = { id: 'buyer', name: 'Strategic buyer', pct: 0, paid: 0, joinedQ: n.fund.q }; no.holders.push(buyer); }
  buyer.pct += pct; buyer.paid += gross; n.ownership = no;
  if (n.publicFirm) {
    const p = n.publicFirm.personal; const purchasedSold = p.shares * share; const released = p.basis * share;
    const proceeds = v.total / n.publicFirm.shares * purchasedSold * (1 - SALE_COST);
    p.shares -= purchasedSold; p.basis -= released; p.realized += proceeds - released;
  }
  if (f.pct <= 1e-6) {
    f.pct = 0;
    end(n, 'sold', `You sold ${n.firmName}`, [
      `After ${n.fund.history.length} quarters you sold your remaining ${(pct * 100).toFixed(1)}% to a strategic buyer for about ${Math.round(gross).toLocaleString('en-US')} dollars before costs.`,
      'The buyer keeps managing the fund and its fees. Client money stays in the fund; your own fund units stay yours.',
    ], [{ label: 'Sale proceeds before costs', value: gross }, { label: 'Transaction costs', value: gross * SALE_COST }]);
  }
  return { c: n, ok: true, message: `Sold ${(pct * 100).toFixed(1)}% for ${Math.round(gross * (1 - SALE_COST)).toLocaleString('en-US')} dollars after costs.` };
}

/** IPO stage 1: file. Needs a year of positive operating profit and reputation 50+. Underwriting prep costs 0.5% of value from firm cash. */
export function fileIpo(c: Career): R {
  if (!running(c)) return fail(c, 'This career has already ended.');
  const o = ownershipOf(c); if (o.ipo) return fail(c, 'The firm has already filed.');
  const v = valuation(c); const rep = reputation(c).score;
  if (v.profit <= 0 || c.fund.history.length < 8) return fail(c, 'Underwriters want two years of history and a profitable last year.');
  if (rep < 50) return fail(c, `Reputation is ${rep}; underwriters want 50 or more.`);
  const prep = v.total * 0.005;
  if (firmCash(c) - c.arrears < prep) return fail(c, 'The firm cannot afford underwriting preparation.');
  const vote = approval(c, 'ipo');
  if (!vote.passed) return fail(recordVoted(c, 'List the firm', vote), `Owners voted ${(vote.yes * 100).toFixed(0)}% yes; ${(vote.needed * 100).toFixed(0)}% needed.`);
  const n: Career = structuredClone(c); recordVote(n, 'List the firm', vote);
  post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'firm', recipient: 'external', category: 'transaction_cost', amount: prep, source: `ipo:file:${n.fund.q}`, memo: 'IPO preparation: auditors and underwriters' });
  n.ownership = { ...ownershipOf(n), ipo: { stage: 'filed', filedQ: n.fund.q, preparationFee: prep } };
  return { c: n, ok: true, message: 'Filed. Start the roadshow next quarter, then price the listing.' };
}

/** Indicative price range for the listing, from the valuation and a deterministic investor appetite of 90%-110%. */
export function ipoRange(c: Career) {
  const r = mulberry32(c.fund.seed * 17 + c.fund.q); const v = valuation(c).total;
  const mid = v * (0.9 + r() * 0.2);
  return { low: mid * 0.95, mid, high: mid * 1.05 };
}

/** IPO stage 2: roadshow, at least a quarter after filing. Investors see the business; the price range is set when you list. */
export function startRoadshow(c: Career): R {
  const o = ownershipOf(c);
  if (!running(c)) return fail(c, 'This career has already ended.');
  if (o.ipo?.stage !== 'filed') return fail(c, o.ipo ? 'The roadshow has already started.' : 'File first.');
  if (c.fund.q <= o.ipo.filedQ) return fail(c, 'Regulators need a quarter to review the filing.');
  const n: Career = structuredClone(c); n.ownership = { ...ownershipOf(n), ipo: { ...o.ipo, stage: 'roadshow', roadshowQ: n.fund.q } };
  return { c: n, ok: true, message: 'Roadshow under way. You can price the listing from next quarter.' };
}

/** IPO stage 3: list. You sell `floatPct` of the firm from your stake (6% fees) and the rest is locked up for four quarters. */
export function priceIpo(c: Career, floatPct = 0.2, primary = false): R {
  const o = ownershipOf(c);
  if (!running(c)) return fail(c, 'This career has already ended.');
  if (o.ipo?.stage === 'listed') return fail(c, 'The firm is already listed.');
  if (o.ipo?.stage !== 'roadshow') return fail(c, o.ipo ? 'Run the roadshow first.' : 'File first.');
  if (c.fund.q <= (o.ipo.roadshowQ ?? 0)) return fail(c, 'The roadshow needs at least one quarter.');
  if (typeof floatPct !== 'number' || !Number.isFinite(floatPct) || floatPct <= 0 || floatPct > 0.5) return fail(c, 'The float must be more than 0% and at most 50% of the firm.');
  const you = founderPct(c); if (!primary && floatPct > you + 1e-9) return fail(c, `You own ${(you * 100).toFixed(1)}%; you cannot float more than that.`);
  const sell = floatPct;
  const range = ipoRange(c);
  const issued = primary ? Math.floor(INITIAL_PUBLIC_SHARES * sell / (1 - sell)) : 0;
  const gross = primary ? issued * range.mid / INITIAL_PUBLIC_SHARES : range.mid * sell;
  const n: Career = structuredClone(c); const no = ownershipOf(n);
  const recipient = primary ? 'firm' : 'founder';
  post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: 'external', recipient, category: primary ? 'equity_sale' : 'firm_sale', amount: gross, source: `ipo:list:${n.fund.q}`, memo: `IPO: ${primary ? 'issued new shares' : 'sold founder shares'} in ${n.firmName}` });
  post(n.journal, { q: n.fund.q, date: lbl(n, n.fund.q), payer: recipient, recipient: 'external', category: 'transaction_cost', amount: gross * IPO_COST, source: `ipo:list:${n.fund.q}:cost`, memo: 'Underwriting fees (6%)' });
  const f = no.holders.find(h => h.id === 'founder');
  if (!f || !no.ipo) return fail(c, 'The founder share register or filing is missing.');
  const totalShares = INITIAL_PUBLIC_SHARES + issued;
  const actualFloat = primary ? issued / totalShares : sell;
  if (primary) for (const h of no.holders) h.pct *= INITIAL_PUBLIC_SHARES / totalShares;
  else f.pct -= sell;
  no.holders.push({ id: 'public', name: 'Public shareholders', pct: actualFloat, paid: gross, joinedQ: n.fund.q });
  no.ipo = { ...no.ipo, stage: 'listed', listedQ: n.fund.q, price: range.mid + (primary ? gross : 0), lockupUntilQ: n.fund.q + 4, floatPct: actualFloat };
  n.ownership = no;
  n.publicFirm = { version: 1, shares: totalShares, listingPrice: range.mid / INITIAL_PUBLIC_SHARES, primaryRaised: primary ? gross : 0, listingFees: gross * IPO_COST + (no.ipo.preparationFee ?? 0), sentiment: 0, coverageQ: -1, coverageHeadline: '', loans: [], history: [], personal: { shares: 0, basis: 0, realized: 0, dividends: 0 }, dividendsPerShare: 0 };
  return { c: n, ok: true, message: `Listed. ${primary ? 'The firm' : 'You'} received ${Math.round(gross * (1 - IPO_COST)).toLocaleString('en-US')} dollars after fees; remaining founder shares are locked up for a year.` };
}

/** Successors: staff at level 3 or ability 70+, or the named heir. */
export const successors = (c: Career) => c.roster.filter(e => e.level >= 3 || e.ability >= 70 || e.id === lifeOf(c).heirId);

/** Retire: hand the firm to a successor and keep your equity (valued as an estimate) and fund units. */
export function retire(c: Career, successorId: string): R {
  if (!running(c)) return fail(c, 'This career has already ended.');
  const e = successors(c).find(x => x.id === successorId); if (!e) return fail(c, 'Choose a qualified successor.');
  const vote = approval(c, 'succession', e.ability);
  if (!vote.passed) return fail(recordVoted(c, `Hand over to ${e.name}`, vote), `Owners voted ${(vote.yes * 100).toFixed(0)}% yes for ${e.name}; ${(vote.needed * 100).toFixed(0)}% needed.`);
  const n: Career = structuredClone(c); recordVote(n, `Hand over to ${e.name}`, vote);
  const eq = founderEquityValue(n);
  end(n, 'retired', `You handed ${n.firmName} to ${e.name}`, [
    `${e.name} (${e.role}, ability ${Math.round(e.ability)}) takes over after ${n.fund.history.length} quarters.`,
    `You keep ${(founderPct(n) * 100).toFixed(1)}% of the firm, an estimated ${Math.round(eq).toLocaleString('en-US')} dollars, and your units in the fund.`,
  ], [{ label: 'Estimated value of the equity you keep', value: eq }]);
  return { c: n, ok: true, message: `${e.name} is now running the firm.` };
}

/** An ending for careers that stopped without a sale or retirement (fund closed or reached its term). */
export function derivedEnding(c: Career): Ending {
  if (c.ending) return c.ending;
  const failed = c.fund.status === 'ended' && c.fund.q < c.fund.quarters;
  return { kind: failed ? 'failed' : 'completed', q: c.fund.q, title: failed ? `${c.fundName} was closed` : `${c.fundName} reached the end of its term`,
    story: [failed ? 'The fund could not meet what it owed and was wound down. The firm\'s history is preserved below.' : `The fund ran its full ${c.fund.quarters} quarters.`],
    numbers: museumNumbers(c) };
}

export function finalNetWorth(c: Career) {
  return personalCash(c) + assetsValue(c) + founderStake(c) + founderEquityValue(c) - personalOwed(c);
}

/** A failed vote is still part of the record. */
function recordVoted(c: Career, topic: string, v: ReturnType<typeof approval>): Career { const n: Career = structuredClone(c); recordVote(n, topic, v); return n; }
