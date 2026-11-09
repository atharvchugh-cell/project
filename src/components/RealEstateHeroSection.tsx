import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowRight, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GAME_CONFIGS } from '@/data/realEstateData';
import RealEstatePortfolioCard from './RealEstatePortfolioCard';

export default function RealEstateHeroSection() {
  const navigate = useNavigate();
  const [configIdx, setConfigIdx] = useState(2);

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6 }}
      className="max-w-6xl mx-auto w-full px-4 md:px-8 py-20"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-12 lg:gap-16 items-center">
        <div className="space-y-7">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Home className="w-3.5 h-3.5 text-amber-400" />
            <span>Real Estate Simulator</span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-editorial font-normal tracking-tight leading-[1.0]">
            Build Your <em className="not-italic text-amber-400 font-editorial font-semibold">Empire</em>
          </h2>

          <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-md">
            Buy and sell properties across 10 major U.S. cities using real historical home price data from 1990–2020.
          </p>

          <div className="space-y-3">
            <span className="text-sm font-mono text-muted-foreground font-medium">Game Length</span>
            <div className="flex gap-3 flex-wrap">
              {GAME_CONFIGS.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setConfigIdx(i)}
                  className={`px-4 py-3 rounded-xl border text-sm font-mono transition-all ${
                    configIdx === i
                      ? 'border-amber-400 bg-amber-400/10 text-amber-400 shadow-md shadow-amber-400/10'
                      : 'border-border/50 text-muted-foreground hover:border-amber-400/30 hover:text-foreground'
                  }`}
                >
                  <div className="font-semibold text-base">{c.label}</div>
                  <div className="text-[11px] opacity-60 mt-0.5">{c.years} min</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              size="lg"
              className="text-base px-6 py-5 bg-amber-500 hover:bg-amber-500/90 text-black font-semibold group"
              onClick={() => navigate(`/real-estate-game?config=${configIdx}`)}
            >
              Start Playing
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>

          <div className="flex items-center gap-6 text-xs text-muted-foreground/60 font-mono pt-1">
            <span>10–30 min/game</span>
            <span className="w-px h-3 bg-border" />
            <span>10 cities</span>
            <span className="w-px h-3 bg-border" />
            <span>100% free</span>
          </div>
        </div>

        <div className="hidden lg:block">
          <RealEstatePortfolioCard />
        </div>
      </div>
    </motion.section>
  );
}
