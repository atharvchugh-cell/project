// Operating dashboard for personal ventures. Pure presentation derived from the saved venture's
// revenue, costs and level: it never moves money and adds nothing to the save.
import type { Career } from './career';
import { type Venture, ventureQuarter } from './ventures';

interface OpsProfile {
  /** Quarterly cost of one employee (wages and benefits). */ staffCost: number;
  /** Share of costs that is payroll. */ payrollShare: number;
  unit: string; baseUnits: number; unitsPerLevel: number;
  /** Total quarterly sales of the local/national market this business competes in. */ marketQ: number;
  /** Market grows a little each quarter. */ marketGrowthQ: number;
  products: string[];
}
const P = (staffCost: number, payrollShare: number, unit: string, baseUnits: number, unitsPerLevel: number, marketQ: number, products: string[]): OpsProfile =>
  ({ staffCost, payrollShare, unit, baseUnits, unitsPerLevel, marketQ, marketGrowthQ: 0.006, products });

const OPS: Record<string, OpsProfile> = {
  'v-coffee': P(9e3, 0.45, 'cafe', 2, 1, 1.5e6, ['Espresso bar', 'Bagged beans', 'Wholesale to offices', 'Subscription boxes', 'Grocery shelves']),
  'v-carwash': P(8e3, 0.35, 'site', 4, 2, 6e6, ['Express wash', 'Unlimited membership', 'Detailing', 'Fleet contracts', 'Electric car care']),
  'v-gym': P(14e3, 0.5, 'studio', 3, 2, 9e6, ['Group classes', 'Personal training', 'Recovery lounge', 'Streaming app', 'Corporate wellness']),
  'v-newsletter': P(30e3, 0.6, 'edition', 1, 1, 12e6, ['Daily brief', 'Premium research', 'Live events', 'Podcast', 'Institutional desk']),
  'v-vineyard': P(12e3, 0.4, 'estate', 1, 1, 30e6, ['House red', 'Reserve label', 'Tasting room', 'Wine club', 'Export line']),
  'v-software': P(45e3, 0.65, 'office', 1, 1, 90e6, ['Order router', 'Risk dashboard', 'Data feeds', 'Compliance suite', 'Cloud platform']),
  'v-hotels': P(11e3, 0.38, 'hotel', 6, 3, 400e6, ['Rooms', 'Restaurants', 'Events and weddings', 'Members club', 'Spa']),
  'v-team': P(400e3, 0.55, 'venue', 1, 1, 900e6, ['Ticketing', 'Media rights', 'Sponsorships', 'Merchandise', 'Youth academy']),
  'v-bank': P(55e3, 0.5, 'branch', 4, 3, 5e9, ['Private banking', 'Mortgages', 'Wealth planning', 'Lending to founders', 'Family office']),
};
const FALLBACK = P(15e3, 0.45, 'location', 1, 1, 20e6, ['Core product', 'Premium line', 'Services', 'Wholesale', 'Online']);

export interface VentureOps {
  employees: number; payrollQ: number; revenuePerEmployee: number;
  locations: number; unit: string;
  products: { name: string; active: boolean; share: number }[];
  marketShare: number; marketSizeQ: number; margin: number;
  history: { q: number; revenue: number; profit: number }[];
}

export function ventureOps(c: Career, v: Venture): VentureOps {
  const o = OPS[v.typeId] ?? FALLBACK;
  const nx = ventureQuarter(c, v);
  const payrollQ = nx.cost * o.payrollShare;
  const employees = Math.max(1, Math.round(payrollQ / o.staffCost));
  const locations = o.baseUnits + o.unitsPerLevel * (v.level - 1);
  const active = Math.min(o.products.length, v.level);
  // Revenue split: earlier products carry more, each new line starts smaller.
  const weights = o.products.map((_, i) => (i < active ? 1 / (i + 1) : 0));
  const total = weights.reduce((a, w) => a + w, 0) || 1;
  const held = Math.max(0, c.fund.q - v.boughtQ);
  const marketSizeQ = o.marketQ * Math.pow(1 + o.marketGrowthQ, held);
  const marketShare = Math.min(0.95, nx.revenue / Math.max(nx.revenue, marketSizeQ));
  return {
    employees, payrollQ, revenuePerEmployee: nx.revenue / employees,
    locations, unit: o.unit,
    products: o.products.map((name, i) => ({ name, active: i < active, share: weights[i] / total })),
    marketShare, marketSizeQ, margin: nx.revenue > 0 ? nx.profit / nx.revenue : 0,
    history: v.history.map(h => ({ q: h.q, revenue: h.revenue, profit: h.profit })),
  };
}
