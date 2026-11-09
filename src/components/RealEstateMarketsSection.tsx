import { motion } from 'framer-motion';
import { CITIES } from '@/data/realEstateData';

const regionMap: Record<string, { tag: string; color: string; bg: string }> = {
  'New York': { tag: 'Northeast', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  'Boston': { tag: 'Northeast', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  'Los Angeles': { tag: 'West Coast', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  'San Diego': { tag: 'West Coast', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  'San Francisco': { tag: 'West Coast', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  'Seattle': { tag: 'West Coast', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  'Chicago': { tag: 'Midwest', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  'Miami': { tag: 'South', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  'Phoenix': { tag: 'Southwest', color: 'text-red-400', bg: 'bg-red-400/10' },
  'Washington DC': { tag: 'Mid-Atlantic', color: 'text-purple-400', bg: 'bg-purple-400/10' },
};

export default function RealEstateMarketsSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6 }}
      className="max-w-5xl mx-auto px-4 md:px-8 py-20"
    >
      <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-400/70 mb-4">Markets</p>
      <h2 className="text-3xl md:text-4xl font-editorial font-semibold font-normal mb-12 tracking-tight">10 Major U.S. Cities</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {CITIES.map((c, i) => {
          const r = regionMap[c.city] || { tag: 'Other', color: 'text-muted-foreground', bg: 'bg-secondary' };
          return (
            <motion.div
              key={c.city}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-xl border border-border/30 bg-card/20 p-4 space-y-2 hover:border-amber-400/30 transition-colors"
            >
              <span className={`font-mono text-[10px] uppercase tracking-wider ${r.bg} ${r.color} px-1.5 py-0.5 rounded`}>{r.tag}</span>
              <div className="font-display font-semibold text-sm">{c.city}</div>
              <div className="font-mono text-xs text-muted-foreground">${c.prices[1990]?.toLocaleString()}</div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
