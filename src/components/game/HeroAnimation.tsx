import { useEffect, useRef } from 'react';

// Seeded random for deterministic patterns
function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

export default function HeroAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement!.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Pre-generate chart lines
    const rng = seeded(42);
    const lines: { points: number[]; speed: number; yBase: number; color: string; width: number; opacity: number }[] = [];
    const colors = [
      'rgba(80,220,160,',   // green/primary - main line
      'rgba(255,180,60,',   // amber/gold
      'rgba(100,160,255,',  // soft blue - faded
      'rgba(200,130,255,',  // lavender/purple - faded
    ];

    for (let l = 0; l < 4; l++) {
      const pts: number[] = [];
      let val = 0.3 + rng() * 0.4;
      for (let i = 0; i < 200; i++) {
        val += (rng() - 0.48) * 0.02;
        val = Math.max(0.05, Math.min(0.95, val));
        pts.push(val);
      }
      // Lines 0-1 are prominent, lines 2-3 are very faded
      const opacities = [0.38, 0.30, 0.10, 0.07];
      const widths = [1.8, 1.4, 0.8, 0.6];
      lines.push({
        points: pts,
        speed: 0.15 + l * 0.08,
        yBase: 0.2 + l * 0.18,
        color: colors[l],
        width: widths[l],
        opacity: opacities[l],
      });
    }

    // Candlesticks
    const candles: { x: number; o: number; c: number; h: number; l: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const o = 0.3 + rng() * 0.4;
      const c = o + (rng() - 0.5) * 0.08;
      candles.push({ x: rng(), o, c, h: Math.max(o, c) + rng() * 0.03, l: Math.min(o, c) - rng() * 0.03 });
    }

    // Data particles
    const particles: { x: number; y: number; vx: number; vy: number; text: string; life: number; maxLife: number }[] = [];
    const dataTexts = ['247.82', '1,892', '+2.4%', '-0.8%', '3,421', '892.1', 'VOL 2.1M', '14,200', '+1.2%', '687.5'];
    for (let i = 0; i < 15; i++) {
      particles.push({
        x: rng() * 1.2, y: rng(), vx: -0.0002 - rng() * 0.0003, vy: (rng() - 0.5) * 0.0001,
        text: dataTexts[Math.floor(rng() * dataTexts.length)], life: rng() * 300, maxLife: 200 + rng() * 200,
      });
    }

    // Grid lines
    const gridLines = Array.from({ length: 8 }, (_, i) => ({ y: (i + 1) / 9, phase: rng() * Math.PI * 2 }));
    const vGridLines = Array.from({ length: 12 }, (_, i) => ({ x: (i + 1) / 13, phase: rng() * Math.PI * 2 }));

    let animId: number;
    const draw = (time: number) => {
      const t = time * 0.001;
      ctx.clearRect(0, 0, w, h);

      // Subtle grid
      for (const g of gridLines) {
        const op = 0.04 + Math.sin(t * 0.3 + g.phase) * 0.02;
        ctx.strokeStyle = `rgba(150,170,200,${op})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, g.y * h);
        ctx.lineTo(w, g.y * h);
        ctx.stroke();
      }
      for (const g of vGridLines) {
        const op = 0.03 + Math.sin(t * 0.25 + g.phase) * 0.015;
        ctx.strokeStyle = `rgba(150,170,200,${op})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(g.x * w, 0);
        ctx.lineTo(g.x * w, h);
        ctx.stroke();
      }

      // Candlesticks (faint, background)
      for (const c of candles) {
        const cx = ((c.x + t * 0.02) % 1.3 - 0.15) * w;
        const op = 0.06 + Math.sin(t * 0.5 + c.x * 10) * 0.03;
        const isGreen = c.c > c.o;
        const col = isGreen ? `rgba(80,220,160,${op})` : `rgba(255,100,100,${op})`;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 1;
        // Wick
        ctx.beginPath();
        ctx.moveTo(cx, c.l * h);
        ctx.lineTo(cx, c.h * h);
        ctx.stroke();
        // Body
        const bodyTop = Math.min(c.o, c.c) * h;
        const bodyH = Math.abs(c.c - c.o) * h;
        if (isGreen) ctx.fillRect(cx - 3, bodyTop, 6, Math.max(bodyH, 1));
        else { ctx.strokeRect(cx - 3, bodyTop, 6, Math.max(bodyH, 1)); }
      }

      // Chart lines
      for (const line of lines) {
        const offset = t * line.speed;
        ctx.beginPath();
        ctx.strokeStyle = line.color + line.opacity + ')';
        ctx.lineWidth = line.width;
        const startIdx = Math.floor(offset * 10) % line.points.length;

        for (let px = 0; px <= w; px += 3) {
          const frac = px / w;
          const idx = (startIdx + frac * 80) % line.points.length;
          const i0 = Math.floor(idx);
          const i1 = (i0 + 1) % line.points.length;
          const f = idx - i0;
          const val = line.points[i0] * (1 - f) + line.points[i1] * f;
          const y = (line.yBase + (val - 0.5) * 0.3) * h;
          if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
        }
        ctx.stroke();

        // Gradient fill below
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, line.color + (line.opacity * 0.3) + ')');
        grad.addColorStop(1, line.color + '0)');
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Pulse dot on main line
        if (line === lines[0]) {
          const pulseX = ((t * 0.1) % 1) * w;
          const pulseIdx = (startIdx + (pulseX / w) * 80) % line.points.length;
          const pi0 = Math.floor(pulseIdx);
          const pi1 = (pi0 + 1) % line.points.length;
          const pf = pulseIdx - pi0;
          const pVal = line.points[pi0] * (1 - pf) + line.points[pi1] * pf;
          const pulseY = (line.yBase + (pVal - 0.5) * 0.3) * h;
          const pulseR = 3 + Math.sin(t * 3) * 1.5;
          ctx.beginPath();
          ctx.arc(pulseX, pulseY, pulseR, 0, Math.PI * 2);
          ctx.fillStyle = line.color + '0.6)';
          ctx.fill();
          // Glow
          const glow = ctx.createRadialGradient(pulseX, pulseY, 0, pulseX, pulseY, 20);
          glow.addColorStop(0, line.color + '0.2)');
          glow.addColorStop(1, line.color + '0)');
          ctx.fillStyle = glow;
          ctx.fillRect(pulseX - 20, pulseY - 20, 40, 40);
        }
      }

      // Data particles
      ctx.font = '10px "Instrument Sans", sans-serif';
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.life++;
        if (p.life > p.maxLife || p.x < -0.1) {
          p.x = 1.1; p.y = rng(); p.life = 0; p.maxLife = 200 + rng() * 200;
          p.text = dataTexts[Math.floor(rng() * dataTexts.length)];
        }
        const fadeIn = Math.min(p.life / 40, 1);
        const fadeOut = Math.min((p.maxLife - p.life) / 40, 1);
        const op = Math.min(fadeIn, fadeOut) * 0.12;
        ctx.fillStyle = `rgba(180,200,220,${op})`;
        ctx.fillText(p.text, p.x * w, p.y * h);
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  );
}
