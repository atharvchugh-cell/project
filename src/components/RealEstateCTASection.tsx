import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RealEstateCTASection() {
  const navigate = useNavigate();

  return (
    <section className="max-w-5xl mx-auto px-4 md:px-8 pb-16 text-center">
      <div className="rounded-2xl border border-border/30 bg-card/30 p-8 md:p-12 space-y-5">
        <h2 className="text-3xl md:text-4xl font-editorial font-semibold font-normal tracking-tight">
          Ready to build your real estate empire?
        </h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Real data. 10 cities. 30 years of housing history. See if you can time the market.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            size="lg"
            className="bg-amber-500 hover:bg-amber-500/90 text-black font-semibold px-8 group"
            onClick={() => navigate('/real-estate-game?config=3')}
          >
            Play Now
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground/60 font-mono justify-center pt-2">
          <span>30 min max</span>
          <span className="w-px h-3 bg-border" />
          <span>10 cities</span>
          <span className="w-px h-3 bg-border" />
          <span>30 years of data</span>
        </div>
      </div>
    </section>
  );
}
