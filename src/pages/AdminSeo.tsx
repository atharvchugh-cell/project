import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, XCircle, RefreshCw, ExternalLink, BarChart3, Image as ImageIcon, FileSearch, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ROUTES = [
  { path: "/", label: "Home — Stock Simulator" },
  { path: "/real-estate-game", label: "Real Estate Game" },
  { path: "/guide", label: "Beginner's Guide" },
];

interface CheckResult { key: string; label: string; ok: boolean; value?: string }
interface RouteAudit { path: string; label: string; status: "loading" | "ok" | "error"; checks: CheckResult[]; schemas: string[]; error?: string }

const META_CHECKS: Array<[string, string, RegExp]> = [
  ["title", "<title>", /<title>([^<]+)<\/title>/i],
  ["description", "meta description", /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i],
  ["canonical", "canonical link", /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i],
  ["og:title", "og:title", /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i],
  ["og:description", "og:description", /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i],
  ["og:image", "og:image", /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i],
  ["og:url", "og:url", /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i],
  ["twitter:card", "twitter:card", /<meta\s+name=["']twitter:card["']\s+content=["']([^"']+)["']/i],
  ["twitter:image", "twitter:image", /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i],
];

type Tab = "coverage" | "images" | "gsc" | "report";

const AdminSeo = () => {
  const [adminCode, setAdminCode] = useState<string>(() => sessionStorage.getItem("admin_code_seo") ?? "");
  const [codeInput, setCodeInput] = useState("");
  const [tab, setTab] = useState<Tab>("coverage");
  const [audits, setAudits] = useState<RouteAudit[]>(ROUTES.map((r) => ({ ...r, status: "loading", checks: [], schemas: [] })));
  const [scanning, setScanning] = useState(false);
  const [ogReport, setOgReport] = useState<any>(null);
  const [ogLoading, setOgLoading] = useState(false);
  const [gsc, setGsc] = useState<any>(null);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscDays, setGscDays] = useState(28);
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const invokeHeaders = adminCode ? { "x-admin-code": adminCode } : undefined;

  const runAudit = async () => {
    setScanning(true);
    const results = await Promise.all(
      ROUTES.map(async (r): Promise<RouteAudit> => {
        try {
          const res = await fetch(r.path, { cache: "no-store" });
          const html = await res.text();
          const checks: CheckResult[] = META_CHECKS.map(([key, label, re]) => {
            const m = html.match(re);
            return { key, label, ok: !!m, value: m?.[1] };
          });
          const schemas: string[] = [];
          const ldRe = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
          let m: RegExpExecArray | null;
          while ((m = ldRe.exec(html))) {
            try { schemas.push(JSON.parse(m[1])["@type"] || "Unknown"); } catch { schemas.push("Invalid JSON-LD"); }
          }
          return { ...r, status: "ok", checks, schemas };
        } catch (e) {
          return { ...r, status: "error", checks: [], schemas: [], error: String(e) };
        }
      })
    );
    setAudits(results); setScanning(false);
  };

  const runOgAudit = async () => {
    setOgLoading(true);
    const { data, error } = await supabase.functions.invoke("og-image-audit", { body: {}, headers: invokeHeaders });
    setOgReport(error ? { error: error.message } : data);
    setOgLoading(false);
  };

  const runGsc = async (days = gscDays) => {
    setGscLoading(true);
    const { data, error } = await supabase.functions.invoke("gsc-metrics", { body: { days }, headers: invokeHeaders });
    setGsc(error ? { error: error.message } : data);
    setGscLoading(false);
  };

  const runReport = async () => {
    setReportLoading(true);
    const { data, error } = await supabase.functions.invoke("weekly-seo-report", { body: {}, headers: invokeHeaders });
    setReport(error ? { error: error.message } : data);
    setReportLoading(false);
  };

  useEffect(() => { if (adminCode) runAudit(); }, [adminCode]);

  if (!adminCode) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <Helmet><title>SEO Admin — Sign in</title><meta name="robots" content="noindex,nofollow" /></Helmet>
        <form
          onSubmit={(e) => { e.preventDefault(); if (codeInput) { sessionStorage.setItem("admin_code_seo", codeInput); setAdminCode(codeInput); } }}
          className="w-full max-w-sm rounded-2xl border border-border/50 bg-card/40 p-6 space-y-4"
        >
          <h1 className="text-xl font-bold">SEO Admin</h1>
          <p className="text-sm text-muted-foreground">Enter the admin code to continue.</p>
          <input
            type="password"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Admin code"
            autoFocus
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button type="submit" className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Unlock</button>
        </form>
      </main>
    );
  }

  const tabs: Array<{ id: Tab; label: string; icon: any }> = [
    { id: "coverage", label: "Schema & Meta", icon: FileSearch },
    { id: "images", label: "OG / Twitter Images", icon: ImageIcon },
    { id: "gsc", label: "Search Console", icon: BarChart3 },
    { id: "report", label: "Weekly Report", icon: Mail },
  ];

  return (
    <>
      <Helmet>
        <title>SEO Admin — Coverage, Images & Search Console</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <header className="mb-6">
            <h1 className="text-3xl font-bold">SEO Admin</h1>
            <p className="text-muted-foreground mt-1">Schema coverage, social-card consistency, and Google Search Console performance.</p>
          </header>

          <nav className="mb-8 flex flex-wrap gap-2 border-b border-border/40">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px transition ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </nav>

          {tab === "coverage" && (
            <>
              <div className="mb-4 flex justify-end">
                <button onClick={runAudit} disabled={scanning} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/40 px-4 py-2 text-sm hover:bg-card/70 disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} /> Re-scan
                </button>
              </div>
              <div className="space-y-6">
                {audits.map((a) => {
                  const passed = a.checks.filter((c) => c.ok).length;
                  return (
                    <section key={a.path} className="rounded-2xl border border-border/50 bg-card/40 p-6">
                      <header className="mb-4 flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-semibold">{a.label}</h2>
                          <a href={a.path} target="_blank" rel="noopener" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-primary">
                            {a.path} <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <div className="text-sm">
                          {a.status === "loading" && <span className="text-muted-foreground">Loading…</span>}
                          {a.status === "ok" && <span className={passed === a.checks.length ? "text-emerald-500" : "text-amber-500"}>{passed}/{a.checks.length} meta tags</span>}
                          {a.status === "error" && <span className="text-destructive">{a.error}</span>}
                        </div>
                      </header>
                      <div className="grid gap-2 md:grid-cols-2">
                        {a.checks.map((c) => (
                          <div key={c.key} className="flex items-start gap-2 text-sm">
                            {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
                            <div className="min-w-0">
                              <div className="font-medium">{c.label}</div>
                              {c.value && <div className="text-xs text-muted-foreground truncate">{c.value}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-border/40">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Schema.org types</div>
                        {a.schemas.length === 0 ? <div className="text-sm text-amber-500">No JSON-LD found</div> : (
                          <div className="flex flex-wrap gap-2">
                            {a.schemas.map((s, i) => <span key={i} className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{s}</span>)}
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}

          {tab === "images" && (
            <section className="rounded-2xl border border-border/50 bg-card/40 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">OG / Twitter image consistency</h2>
                  <p className="text-sm text-muted-foreground">Crawls each key route and verifies image tags are present, absolute, reachable, and consistent.</p>
                </div>
                <button onClick={runOgAudit} disabled={ogLoading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${ogLoading ? "animate-spin" : ""}`} /> Run crawler
                </button>
              </div>
              {!ogReport && <p className="text-sm text-muted-foreground">Click "Run crawler" to fetch reports.</p>}
              {ogReport?.error && <p className="text-sm text-destructive">{ogReport.error}</p>}
              {ogReport?.reports && (
                <div className="space-y-4">
                  <div className="text-sm">
                    <span className={ogReport.totalIssues === 0 ? "text-emerald-500" : "text-amber-500"}>
                      {ogReport.totalIssues} total issue{ogReport.totalIssues === 1 ? "" : "s"}
                    </span>
                    <span className="text-muted-foreground"> · scanned {new Date(ogReport.scannedAt).toLocaleString()}</span>
                  </div>
                  {ogReport.reports.map((r: any) => (
                    <div key={r.path} className="rounded-xl border border-border/40 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-semibold">{r.label}</div>
                          <div className="text-xs text-muted-foreground">{r.path} · HTTP {r.status}</div>
                        </div>
                        {r.issues.length === 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <span className="text-amber-500 text-sm">{r.issues.length} issue(s)</span>}
                      </div>
                      <dl className="grid gap-1 text-xs md:grid-cols-2">
                        <div><dt className="text-muted-foreground inline">og:image: </dt><dd className="inline break-all">{r.ogImage ?? "—"}</dd></div>
                        <div><dt className="text-muted-foreground inline">twitter:image: </dt><dd className="inline break-all">{r.twitterImage ?? "—"}</dd></div>
                        <div><dt className="text-muted-foreground inline">og:image:alt: </dt><dd className="inline">{r.ogImageAlt ?? "—"}</dd></div>
                        <div><dt className="text-muted-foreground inline">twitter:card: </dt><dd className="inline">{r.twitterCard ?? "—"}</dd></div>
                        <div><dt className="text-muted-foreground inline">image size: </dt><dd className="inline">{r.ogImageWidth ?? "?"}×{r.ogImageHeight ?? "?"} · {r.imageContentType ?? "?"} · {r.imageBytes ? `${Math.round(r.imageBytes/1024)}KB` : "?"}</dd></div>
                        <div><dt className="text-muted-foreground inline">reachable: </dt><dd className="inline">{r.imageReachable === undefined ? "—" : r.imageReachable ? "yes" : "no"}</dd></div>
                      </dl>
                      {r.issues.length > 0 && (
                        <ul className="mt-3 space-y-1 text-sm text-amber-500">
                          {r.issues.map((i: string, idx: number) => <li key={idx}>• {i}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "gsc" && (
            <section className="rounded-2xl border border-border/50 bg-card/40 p-6">
              <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-xl font-semibold">Google Search Console</h2>
                  <p className="text-sm text-muted-foreground">Impressions, clicks, CTR, and top queries for the site.</p>
                </div>
                <div className="flex gap-2">
                  <select value={gscDays} onChange={(e) => setGscDays(Number(e.target.value))} className="rounded-lg border border-border bg-card/40 px-3 py-2 text-sm">
                    <option value={7}>Last 7 days</option>
                    <option value={28}>Last 28 days</option>
                    <option value={90}>Last 90 days</option>
                  </select>
                  <button onClick={() => runGsc()} disabled={gscLoading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    <RefreshCw className={`h-4 w-4 ${gscLoading ? "animate-spin" : ""}`} /> Fetch metrics
                  </button>
                </div>
              </div>
              {!gsc && <p className="text-sm text-muted-foreground">Click "Fetch metrics" to load Search Console data.</p>}
              {gsc?.error && <p className="text-sm text-destructive">{gsc.error}</p>}
              {gsc?.totals && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                      ["Clicks", gsc.totals.clicks ?? 0],
                      ["Impressions", gsc.totals.impressions ?? 0],
                      ["CTR", `${((gsc.totals.ctr ?? 0) * 100).toFixed(2)}%`],
                      ["Avg position", (gsc.totals.position ?? 0).toFixed(1)],
                    ].map(([label, val]) => (
                      <div key={label as string} className="rounded-xl border border-border/40 p-4">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
                        <div className="text-2xl font-bold mt-1">{val}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Top pages</h3>
                      <div className="space-y-1">
                        {(gsc.pages ?? []).slice(0, 15).map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/20">
                            <span className="truncate flex-1 mr-2">{p.keys?.[0]?.replace("https://investmentsimulator.app", "") || "—"}</span>
                            <span className="text-muted-foreground tabular-nums">{p.clicks}c · {p.impressions}i</span>
                          </div>
                        ))}
                        {(gsc.pages ?? []).length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Top queries</h3>
                      <div className="space-y-1">
                        {(gsc.queries ?? []).slice(0, 15).map((q: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/20">
                            <span className="truncate flex-1 mr-2">{q.keys?.[0] || "—"}</span>
                            <span className="text-muted-foreground tabular-nums">{q.clicks}c · {q.impressions}i · pos {q.position?.toFixed(1)}</span>
                          </div>
                        ))}
                        {(gsc.queries ?? []).length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {tab === "report" && (
            <section className="rounded-2xl border border-border/50 bg-card/40 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Weekly SEO report</h2>
                  <p className="text-sm text-muted-foreground">Aggregates SEO monitor, OG image audit, and Search Console metrics. Auto-sends every Monday at 14:00 UTC to atharv.chugh@gmail.com.</p>
                </div>
                <button onClick={runReport} disabled={reportLoading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${reportLoading ? "animate-spin" : ""}`} /> Send now
                </button>
              </div>
              {report && (
                <pre className="rounded-xl border border-border/40 bg-card/20 p-4 text-xs overflow-x-auto">{JSON.stringify(report, null, 2)}</pre>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
};

export default AdminSeo;
