import { Link } from "react-router-dom";
import { BookOpen, GraduationCap, LineChart, TrendingDown } from "lucide-react";

const RESOURCES = [
  { to: "/learn/how-to-use-stock-market-simulator", icon: BookOpen, title: "How to use the simulator", body: "Modes, deposits, the benchmark and saving, step by step." },
  { to: "/for-teachers", icon: GraduationCap, title: "Teacher guide", body: "Run a Classroom room, plus a printable student worksheet." },
  { to: "/learn/stock-market-crashes", icon: TrendingDown, title: "Market crashes explained", body: "2000, 2008 and 2020, with periods you can replay." },
  { to: "/learn", icon: LineChart, title: "All lessons", body: "Beginner guides, diversification and our data methods." },
];

/** Restrained homepage block linking to the main learning resources. */
export function HomeResources() {
  return (
    <section className="border-t border-border/30" aria-labelledby="resources-title">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-12">
        <h2 id="resources-title" className="text-2xl md:text-3xl font-display font-semibold mb-6">Learn and teach with the simulator</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RESOURCES.map(({ to, icon: Icon, title, body }) => (
            <li key={to}>
              <Link to={to} className="block h-full rounded-xl border border-border/50 bg-card/40 p-5 hover:border-primary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Icon className="w-5 h-5 text-primary mb-3" aria-hidden="true" />
                <span className="block font-display font-semibold mb-1">{title}</span>
                <span className="block text-sm text-muted-foreground">{body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
