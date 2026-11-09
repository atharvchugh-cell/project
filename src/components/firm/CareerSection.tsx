import type { ReactNode } from 'react';

/** Unframed workspace bands; only repeated records and actual tools use cards. */
export function CareerSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="career-section min-w-0" aria-label={title}>
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h2 className="text-base font-semibold">{title}</h2>{action}</div>
    {children}
  </section>;
}