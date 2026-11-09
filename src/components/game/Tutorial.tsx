import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Rocket } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { getSessionId } from '@/lib/analytics';
import { analyticsAllowed } from '@/lib/privacy';

/** Fire-and-forget tutorial funnel event (start/complete). Never blocks gameplay. */
function recordTutorialEvent(event: 'start' | 'complete') {
  if (!analyticsAllowed()) return;
  try {
    // The PostgREST builder is lazy — without `.then` it never sends the request.
    supabase.from('tutorial_events').insert({ session_id: getSessionId(), event }).then(() => {}, () => {});
  } catch { /* ignore */ }
}

interface TutorialStep {
  target: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: '__intro__',
    title: '🎓 Welcome to Rise to Riches!',
    content:
      "You're about to play an investing simulation based on real historical market data. Your goal: grow your wealth by choosing how to invest your money. Every quarter (15 seconds) you'll receive $5,000 in new cash — it's up to you whether to invest it, save it, or split it across different options.",
    position: 'center',
  },
  {
    target: 'cd-panel',
    title: '🏦 Certificates of Deposit (CDs)',
    content:
      "CDs are low-risk investments that pay a fixed return over a set time (1, 2, or 5 years). Your money is locked until the CD matures — you can't freely use it. CDs are safer than stocks but grow slower. The trade-off: more safety, less flexibility.",
    position: 'right',
  },
  {
    target: 'asset-fund',
    title: '📊 S&P 500 Mutual Fund',
    content:
      "This fund tracks a large group of major companies, giving you broad market exposure in one investment. It's less risky than picking a single stock because your money is spread across many businesses. It can still rise and fall with the market, but it's one of the most popular long-term investments.",
    position: 'left',
  },
  {
    target: 'asset-stock',
    title: '📈 Individual Stocks',
    content:
      "Stocks represent ownership in a single company. They can grow faster than the mutual fund — but they can also crash much harder. Your success depends on that one company's performance. Bigger potential rewards come with bigger risk, especially if you put too much money in one stock.",
    position: 'left',
  },
  {
    target: 'asset-gold',
    title: '🥇 Gold',
    content:
      "Gold is a different kind of asset. It's often used as a defensive investment and can behave differently during market stress. It won't always protect you, but it can provide diversification because it doesn't always move in the same direction as stocks.",
    position: 'left',
  },
  {
    target: 'asset-oil',
    title: '🛢️ Crude Oil',
    content:
      "Oil tracks the price of crude oil — one of the most important commodities in the world. Oil prices can swing wildly based on global events like wars, supply cuts, or economic slowdowns. It can be a great performer in booming economies, but it carries high volatility.",
    position: 'left',
  },
  {
    target: 'asset-hysa',
    title: '🏦 High-Yield Savings Account',
    content:
      "A High-Yield Savings Account earns interest on your money at rates that change over time. It's the safest investment option — your balance only goes up. However, the growth is slow compared to stocks. Great for parking cash you want to keep safe while still earning a little return.",
    position: 'left',
  },
  {
    target: 'cash-balance',
    title: '💵 Your Cash Balance',
    content:
      "Cash is money you have available to invest right now. It doesn't go up or down in value, which makes it safe — but it also doesn't grow. Holding cash gives you flexibility to act on opportunities, but keeping too much uninvested may limit your long-term growth.",
    position: 'right',
  },
  {
    target: 'contributions',
    title: '💰 Quarterly Contributions',
    content:
      "Every quarter (15 seconds), you receive $5,000 in new cash. This simulates a regular income. You decide whether to invest it immediately, split it between assets, or keep some as cash. Regular investing is one of the biggest drivers of long-term wealth!",
    position: 'right',
  },
  {
    target: 'year-tracker',
    title: '⏱️ Year Tracker & Timer',
    content:
      "Each simulated year lasts about a minute at 1× speed. The bar shows how far through your game you are, and the Pause and 1× / 2× / 4× controls sit just above the market. Prices keep moving as time passes — waiting too long could mean missing market changes!",
    position: 'bottom',
  },
  {
    target: 'price-area',
    title: '📉 Price Movements',
    content:
      "Prices change throughout the year and reflect real historical performance. Some assets will rise while others fall, depending on what actually happened in history. This isn't random — it's based on real market patterns from the past.",
    position: 'left',
  },
  {
    target: 'buy-sell-actions',
    title: '🛒 Buying & Selling',
    content:
      "Clicking Buy uses your cash to purchase shares. Clicking Sell converts shares back to cash. Every decision changes your portfolio. Smart allocation matters more than constant trading — think carefully about each move!",
    position: 'left',
  },
  {
    target: 'portfolio-summary',
    title: '📋 Portfolio Summary',
    content:
      "This panel shows your total portfolio value, available cash, and investment holdings. Your success is measured by total wealth at the end of the game — not short-term movement in any single asset. Think long-term!",
    position: 'right',
  },
  {
    target: '__final__',
    title: '🚀 Ready to Invest!',
    content:
      "Your goal: make thoughtful investment decisions over the whole game, manage risk, and grow as much wealth as possible. Different assets behave differently — there's no guarantee the riskiest choice will always win. Diversification, timing, and patience are your best tools. Good luck!",
    position: 'center',
  },
];

const COMPLEX_SEARCH_STEP: TutorialStep = {
  target: 'complex-search',
  title: '🔍 Search the Market',
  content:
    "In Complex Mode you can search almost 200 real companies by ticker or name (e.g. AAPL, Microsoft). Companies that haven't IPO'd yet are hidden until their year arrives. Click any result to instantly trade it, or hit the Watch button to pin it to your watchlist (up to 10 stocks). You start with 4 popular picks already on your watchlist.",
  position: 'bottom',
};

interface TutorialProps {
  onComplete: () => void;
  gameMode?: 'normal' | 'complex' | 'hard';
}

function getIsMobile() {
  return window.innerWidth < 768;
}

export function Tutorial({ onComplete, gameMode = 'normal' }: TutorialProps) {
  const TUTORIAL_STEPS_RESOLVED = gameMode === 'complex'
    ? [TUTORIAL_STEPS[0], COMPLEX_SEARCH_STEP, ...TUTORIAL_STEPS.slice(1)]
    : TUTORIAL_STEPS;
  const [step, setStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(getIsMobile);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const startedRef = useRef(false);

  // Record the funnel "start" once per tutorial open.
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      recordTutorialEvent('start');
    }
  }, []);

  const currentStep = TUTORIAL_STEPS_RESOLVED[step];
  const isFirst = step === 0;
  const isLast = step === TUTORIAL_STEPS_RESOLVED.length - 1;
  const isCenter = currentStep.target === '__intro__' || currentStep.target === '__final__';

  const updateHighlight = useCallback(() => {
    setIsMobile(getIsMobile());
    if (isCenter) {
      setHighlightRect(null);
      return;
    }
    const el = document.querySelector(`[data-tutorial="${currentStep.target}"]`);
    if (el) {
      // Scroll element into view on mobile
      if (getIsMobile()) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Small delay to let scroll settle before measuring
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setHighlightRect(el.getBoundingClientRect());
          });
        });
      } else {
        setHighlightRect(el.getBoundingClientRect());
      }
    } else {
      setHighlightRect(null);
    }
  }, [currentStep.target, isCenter]);

  useEffect(() => {
    updateHighlight();
    const onResize = () => {
      setIsMobile(getIsMobile());
      updateHighlight();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', updateHighlight);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', updateHighlight);
    };
  }, [updateHighlight]);

  const next = () => {
    if (isLast) {
      recordTutorialEvent('complete');
      onComplete();
    } else {
      setDirection(1);
      setStep(s => s + 1);
    }
  };

  const back = () => {
    if (!isFirst) {
      setDirection(-1);
      setStep(s => s - 1);
    }
  };

  // On mobile: always position tooltip at bottom of screen as a sheet
  // On desktop: position relative to highlighted element
  const getTooltipStyle = (): React.CSSProperties => {
    if (isCenter || !highlightRect) {
      if (isMobile) {
        return {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: '100%',
          width: '100%',
          borderRadius: '1rem 1rem 0 0',
        };
      }
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '480px',
        width: '90vw',
      };
    }

    // Mobile: always bottom sheet
    if (isMobile) {
      return {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth: '100%',
        width: '100%',
        borderRadius: '1rem 1rem 0 0',
      };
    }

    // Desktop positioning
    const padding = 16;
    const pos = currentStep.position || 'right';
    const style: React.CSSProperties = {
      position: 'fixed',
      maxWidth: '360px',
      width: '360px',
    };

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    switch (pos) {
      case 'right': {
        const leftPos = highlightRect.right + padding;
        // If not enough room on right, flip to bottom
        if (leftPos + 360 > vw) {
          style.left = Math.max(padding, highlightRect.left);
          style.top = Math.min(highlightRect.bottom + padding, vh - 280);
          style.maxWidth = `${vw - padding * 2}px`;
        } else {
          style.left = leftPos;
          style.top = Math.max(padding, Math.min(highlightRect.top, vh - 280));
        }
        break;
      }
      case 'left': {
        const rightSpace = vw - highlightRect.left;
        if (highlightRect.left < 380) {
          // Not enough room on left, position below
          style.left = Math.max(padding, highlightRect.left);
          style.top = Math.min(highlightRect.bottom + padding, vh - 280);
          style.maxWidth = `${vw - padding * 2}px`;
        } else {
          style.right = rightSpace + padding;
          style.top = Math.max(padding, Math.min(highlightRect.top, vh - 280));
        }
        break;
      }
      case 'bottom':
        style.left = Math.max(padding, Math.min(highlightRect.left, vw - 376));
        style.top = Math.min(highlightRect.bottom + padding, vh - 280);
        break;
      case 'top':
        style.left = Math.max(padding, Math.min(highlightRect.left, vw - 376));
        style.bottom = vh - highlightRect.top + padding;
        break;
    }

    return style;
  };

  const renderOverlay = () => {
    const p = 8;
    return (
      <svg
        className="fixed inset-0 z-[9998] pointer-events-none"
        width="100%"
        height="100%"
        style={{ width: '100vw', height: '100vh' }}
      >
        <defs>
          <mask id="tutorial-mask">
            <rect width="100%" height="100%" fill="white" />
            {highlightRect && (
              <rect
                x={highlightRect.left - p}
                y={highlightRect.top - p}
                width={highlightRect.width + p * 2}
                height={highlightRect.height + p * 2}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.75)"
          mask="url(#tutorial-mask)"
        />
        {highlightRect && (
          <motion.rect
            key={`border-${step}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            x={highlightRect.left - p}
            y={highlightRect.top - p}
            width={highlightRect.width + p * 2}
            height={highlightRect.height + p * 2}
            rx="12"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            className="animate-pulse"
          />
        )}
      </svg>
    );
  };

  const tooltipVariants = {
    enter: (dir: number) => ({
      opacity: 0,
      y: isMobile ? 40 : dir > 0 ? 20 : -20,
      scale: isMobile ? 1 : 0.97,
    }),
    center: {
      opacity: 1,
      y: 0,
      scale: 1,
    },
    exit: (dir: number) => ({
      opacity: 0,
      y: isMobile ? 40 : dir > 0 ? -20 : 20,
      scale: isMobile ? 1 : 0.97,
    }),
  };

  return (
    <>
      {/* Click-blocking overlay */}
      <div className="fixed inset-0 z-[9997]" onClick={e => e.stopPropagation()} />

      {renderOverlay()}

      {/* Tooltip card with AnimatePresence */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={tooltipVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={getTooltipStyle()}
          className="z-[9999] rounded-xl bg-card border-2 border-primary/30 shadow-2xl shadow-primary/10 p-4 sm:p-6 space-y-3 sm:space-y-4"
        >
          {/* Step indicator */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 sm:gap-1.5">
              {TUTORIAL_STEPS_RESOLVED.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? 'w-5 sm:w-6 bg-primary'
                      : i < step
                      ? 'w-1.5 bg-primary/50'
                      : 'w-1.5 bg-muted'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {step + 1}/{TUTORIAL_STEPS_RESOLVED.length}
            </span>
          </div>

          <div>
            <h3 className="font-display font-bold text-base sm:text-lg mb-1.5 sm:mb-2">{currentStep.title}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{currentStep.content}</p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-1 sm:pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground text-xs sm:text-sm px-2 sm:px-3"
              onClick={onComplete}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Skip
            </Button>
            <div className="flex gap-2">
              {!isFirst && (
                <Button variant="outline" size="sm" onClick={back} className="text-xs sm:text-sm px-2 sm:px-3">
                  <ChevronLeft className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              )}
              <Button size="sm" onClick={next} className={`text-xs sm:text-sm px-3 sm:px-4 ${isLast ? 'bg-primary hover:bg-primary/90' : ''}`}>
                {isLast ? (
                  <>
                    <Rocket className="w-4 h-4 mr-1" />
                    Start Investing!
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
