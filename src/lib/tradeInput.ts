/**
 * Shared quantity parsing + order validation for every trade surface.
 *
 * F02 fix: the old implementation stripped every non-digit character and
 * re-joined the remaining digits, so "10.5" silently became 105. Parsing now
 * reads the WHOLE input as a number (commas / spaces are thousands separators,
 * a single dot is a decimal point) and clamps the resulting value.
 */

export interface QuantityOptions {
  /** Allow fractional units (stocks/funds/BTC). Properties stay whole-unit. */
  fractional?: boolean;
  /** Decimal places kept when fractional. Default 4 (BTC-friendly: pass 8). */
  precision?: number;
}

const DEFAULT_PRECISION = 4;

function roundTo(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Floors to the allowed precision so a clamp can never spend more than `max`. */
export function floorTo(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.floor((value + Number.EPSILON) * f) / f;
}

/**
 * Parses a user-typed quantity. Returns null when the text is not a usable
 * number (blank, "abc", "1.2.3", Infinity, NaN, negative).
 */
export function parseQuantity(raw: string, opts: QuantityOptions = {}): number | null {
  const precision = opts.fractional ? (opts.precision ?? DEFAULT_PRECISION) : 0;
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/[,\s_]/g, '');
  if (cleaned === '') return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;
  if (cleaned === '.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > 1e12) return null;
  return floorTo(n, precision);
}

/**
 * Per-keystroke handler. Keeps the user's raw text (so they can keep typing a
 * decimal) but rejects characters that don't belong and clamps to `max`.
 */
export function sanitizeShareInput(raw: string, max: number, opts: QuantityOptions = {}): string {
  const precision = opts.fractional ? (opts.precision ?? DEFAULT_PRECISION) : 0;
  let text = String(raw ?? '').replace(/[,\s_]/g, '');
  if (text === '') return '';

  // Keep only digits plus (when fractional) the first decimal point.
  text = text.replace(/[^0-9.]/g, '');
  const firstDot = text.indexOf('.');
  if (precision <= 0) {
    // Whole-unit asset: TRUNCATE at the decimal point. Never delete the dot and
    // glue the digits together (that is what turned 10.5 into 105).
    if (firstDot !== -1) text = text.slice(0, firstDot);
  } else if (firstDot !== -1) {
    text = text.slice(0, firstDot + 1) + text.slice(firstDot + 1).replace(/\./g, '');
    const [intPart, decPart = ''] = text.split('.');
    text = `${intPart}.${decPart.slice(0, precision)}`;
  }
  if (text === '') return '';
  if (text === '.') return '0.';

  const n = Number(text);
  if (!Number.isFinite(n)) return '';

  const cappedMax = Math.max(0, floorTo(max, precision));
  if (n > cappedMax) return formatQuantity(cappedMax, precision);
  // Strip redundant leading zeros ("007" -> "7") but keep "0." / "0.5" intact.
  return text.replace(/^0+(?=\d)/, '');
}

function formatQuantity(n: number, precision: number): string {
  if (precision <= 0) return String(Math.floor(n));
  return String(roundTo(n, precision));
}

/** Blur handler: coerce to a valid, executable quantity. */
export function normalizeShareOnBlur(raw: string, max: number, opts: QuantityOptions = {}): string {
  const precision = opts.fractional ? (opts.precision ?? DEFAULT_PRECISION) : 0;
  const cappedMax = floorTo(Math.max(0, max), precision);
  const smallest = precision > 0 ? Math.pow(10, -precision) : 1;
  if (cappedMax < smallest) return '0';
  const n = parseQuantity(raw, opts);
  if (n === null || n < smallest) return formatQuantity(smallest, precision);
  if (n > cappedMax) return formatQuantity(cappedMax, precision);
  return formatQuantity(n, precision);
}

export interface TradeBlockReason {
  blocked: boolean;
  message: string | null;
}

/**
 * Returns whether the Confirm trade button should be disabled along with a
 * user-readable reason. Shared by every trade surface so the preview, the
 * confirmation and the execution can never disagree.
 */
export function getTradeBlockReason(opts: {
  tradeType: 'buy' | 'sell';
  shares: number;
  maxBuyShares: number;
  maxSellShares: number;
  pricePerShare: number;
  cash: number;
  unitLabel?: string;
  /** Explanation when a non-cash limit (e.g. Bitcoin cap) binds. */
  limitReason?: string | null;
}): TradeBlockReason {
  const { tradeType, shares, maxBuyShares, maxSellShares, pricePerShare, cash } = opts;
  const unit = opts.unitLabel ?? 'share';
  if (!Number.isFinite(shares) || shares <= 0) {
    return { blocked: true, message: `Enter at least 1 ${unit} to confirm this trade.` };
  }
  if (!Number.isFinite(pricePerShare) || pricePerShare <= 0) {
    return { blocked: true, message: 'This price is unavailable right now — try again in a moment.' };
  }
  if (tradeType === 'buy') {
    if (shares > maxBuyShares) {
      if (opts.limitReason) return { blocked: true, message: opts.limitReason };
      const shortfall = shares * pricePerShare - cash;
      return {
        blocked: true,
        message: shortfall > 0
          ? `You only have $${cash.toFixed(2)} in cash — this order is short by $${shortfall.toFixed(2)}.`
          : `You can buy at most ${maxBuyShares} ${unit}${maxBuyShares === 1 ? '' : 's'} with your available cash.`,
      };
    }
  } else {
    if (shares > maxSellShares) {
      return {
        blocked: true,
        message: `You only own ${maxSellShares} ${unit}${maxSellShares === 1 ? '' : 's'} of this stock — you can't sell more than you hold.`,
      };
    }
  }
  return { blocked: false, message: null };
}

/** Share of total portfolio value Bitcoin holdings may reach (0.01%). */
export const CRYPTO_CAP_FRACTION = 0.0001;

export interface MaxBuyResult {
  /** Whole units that can actually execute right now. */
  max: number;
  /** Units affordable with cash alone. */
  cashMax: number;
  /** True when the crypto cap, not cash, is the binding limit. */
  capLimited: boolean;
  /** Plain-language reason when fewer units than cash allows are available. */
  reason: string | null;
}

/**
 * The single executable-quantity calculation for buys. Used for Max, percent
 * shortcuts, input limits, the preview, confirm availability AND execution, so
 * they can never disagree.
 */
export function getMaxBuyUnits(opts: {
  cash: number;
  price: number;
  isCrypto?: boolean;
  portfolioValue?: number;
  currentCryptoValue?: number;
}): MaxBuyResult {
  const { cash, price } = opts;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(cash)) {
    return { max: 0, cashMax: 0, capLimited: false, reason: null };
  }
  const cashMax = Math.max(0, Math.floor((cash + 1e-9) / price));
  if (!opts.isCrypto) return { max: cashMax, cashMax, capLimited: false, reason: null };
  const capValue = Math.max(0, (opts.portfolioValue ?? 0) * CRYPTO_CAP_FRACTION);
  const room = capValue - (opts.currentCryptoValue ?? 0);
  const capMax = room > 0 ? Math.floor((room + 1e-9) / price) : 0;
  const max = Math.min(cashMax, capMax);
  const capLimited = capMax < cashMax;
  let reason: string | null = null;
  if (capLimited) {
    reason = capMax <= 0
      ? `Bitcoin is capped at 0.01% of your portfolio (about $${capValue.toFixed(2)} right now). One coin costs more than that, so you can't buy any yet.`
      : `Bitcoin is capped at 0.01% of your portfolio, so you can buy at most ${capMax} right now.`;
  }
  return { max, cashMax, capLimited, reason };
}
