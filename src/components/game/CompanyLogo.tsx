import { useEffect, useState } from 'react';
import { getCompanyLogo } from '@/lib/companyLogos';

const SIZE_CLASSES = {
  xs: 'h-7 w-7 text-[8px] rounded-md',
  sm: 'h-9 w-9 text-[9px] rounded-md',
  md: 'h-11 w-11 text-[10px] rounded-lg',
  lg: 'h-14 w-14 text-xs rounded-lg',
} as const;

interface CompanyLogoProps {
  ticker: string;
  companyName?: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function CompanyLogo({ ticker, companyName, size = 'sm', className = '' }: CompanyLogoProps) {
  const src = getCompanyLogo(ticker);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src, ticker]);

  const label = ticker.trim().toUpperCase() || '—';
  const frame = `${SIZE_CLASSES[size]} shrink-0 overflow-hidden border border-border/60 ${className}`;

  if (!src || failed) {
    return (
      <span
        className={`${frame} inline-flex items-center justify-center bg-secondary text-foreground font-mono font-bold leading-none`}
        aria-label={`${companyName ?? label} ticker badge`}
        title={companyName ?? label}
      >
        <span className="max-w-full truncate px-1">{label}</span>
      </span>
    );
  }

  return (
    <span className={`${frame} inline-flex items-center justify-center bg-primary-foreground p-1`}>
      <img
        src={src}
        alt={`${companyName ?? label} logo`}
        className="block h-full w-full object-contain"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
