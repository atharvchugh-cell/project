import { motion } from 'framer-motion';

const steps = [
  { n: '01', title: 'Pick your market', desc: 'Choose from 10 major U.S. cities or let the game randomize for you.' },
  { n: '02', title: 'Learn the basics', desc: 'A quick overview of how property investing works in the simulation.' },
  { n: '03', title: 'Invest every year', desc: 'Receive annual cash injections to buy properties across your portfolio.' },
  { n: '04', title: 'Compare your results', desc: 'See how your real estate empire stacks up against other players.' },
];

export default function RealEstateHowItWorks() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6 }}
      className="max-w-5xl mx-auto px-4 md:px-8 py-20 text-center"
    >
      <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-400/70 mb-4">How it works</p>
      <h2 className="text-3xl md:text-4xl font-editorial font-semibold font-normal mb-12 max-w-xl mx-auto tracking-tight">
        From zero to property mogul in four steps
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border/30 rounded-xl overflow-hidden">
        {steps.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="bg-card/20 p-6 space-y-3"
          >
            <span className="font-mono text-amber-400/40 text-sm">{s.n}</span>
            <h3 className="font-display font-semibold">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
