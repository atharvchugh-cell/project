export const firmMoney = (v: number) => {
  const a = Math.abs(v); const s = v < 0 ? '−' : '';
  if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 999_500) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a)}`;
};
export const firmPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
