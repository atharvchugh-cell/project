import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Coins, Home, LayoutDashboard, Lock, MessageSquare, PanelLeftClose, PanelLeftOpen, ShieldCheck, Sparkles, TrendingUp, Users } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function AdminDashboardShell({ children, tab, onTab, onLock, lastSync, aiLocked }: {
  children: ReactNode; tab: "players" | "ai"; onTab: (tab: "players" | "ai") => void;
  onLock: () => void; lastSync: Date | null; aiLocked: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = [
    { label: "Overview", icon: LayoutDashboard, tab: "players" as const },
    { label: "Players", icon: Users, to: "/admin/players" },
    { label: "AI usage", icon: Sparkles, tab: "ai" as const },
    { label: "Credits & budget", icon: Coins, to: "/admin/credits" },
    { label: "Suggestions", icon: MessageSquare, to: "/admin/suggestions" },
  ];
  return <TooltipProvider delayDuration={150}>
    <div className="admin-dashboard-scope min-h-screen bg-background text-foreground">
      <Helmet>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap" />
      </Helmet>
      <aside className={cn("admin-sidebar fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-card transition-[width,transform] duration-200", collapsed ? "w-20" : "w-64", mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}>
        <Link to="/" className="flex min-h-24 items-center gap-3 px-6" aria-label="Rise to Riches home">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><TrendingUp className="h-5 w-5" /></span>
          {!collapsed && <span className="admin-heading text-base font-semibold leading-snug">Rise to Riches<span className="mt-1 block font-normal text-xs text-muted-foreground">Admin workspace</span></span>}
        </Link>
        <nav aria-label="Admin navigation" className="flex-1 space-y-2 px-3 pt-4">
          {links.map(item => <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <Button variant="ghost" className={cn("h-12 w-full justify-start px-3", item.tab === tab ? "border border-primary/20 bg-primary/10 text-primary" : "text-muted-foreground", collapsed && "justify-center px-0")} aria-label={item.label} aria-current={item.tab === tab ? "page" : undefined}
                onClick={item.tab ? () => { if (item.tab) onTab(item.tab); setMobileOpen(false); } : undefined} asChild={!!item.to}>
                {item.to ? <Link to={item.to}><item.icon />{!collapsed && item.label}</Link> : <><item.icon />{!collapsed && item.label}</>}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
          </Tooltip>)}
          <div className="my-5 border-t border-border" />
          <Button variant="ghost" asChild className={cn("w-full justify-start text-muted-foreground", collapsed && "justify-center px-0")} title="Back to game"><Link to="/"><Home />{!collapsed && "Back to game"}</Link></Button>
        </nav>
        {!collapsed && <div className="mx-5 mb-5 border-t border-border pt-5 text-xs text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 text-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Private admin access</div>
          <div className="flex items-center gap-2"><span className={cn("h-1.5 w-1.5 rounded-full", aiLocked ? "bg-accent" : "bg-primary")} /> AI {aiLocked ? "paused" : "enabled"}</div>
        </div>}
        <Button variant="ghost" className="m-3 text-muted-foreground" onClick={onLock} aria-label="Lock dashboard"><Lock />{!collapsed && "Lock dashboard"}</Button>
      </aside>
      <div className={cn("min-w-0 transition-[margin] duration-200", collapsed ? "md:ml-20" : "md:ml-64")}>
        <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(v => !v)} aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen}><PanelLeftOpen /></Button>
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><BarChart3 className="h-4 w-4" /> Workspace <span className="text-border">/</span> <span className="text-foreground">{tab === "ai" ? "AI usage" : "Overview"}</span></span>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{lastSync ? `Updated ${lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting…"}</span>
        </div>
        <main className="mx-auto w-full max-w-6xl space-y-8 p-4 lg:p-8">{children}</main>
      </div>
      {mobileOpen && <Button variant="ghost" className="fixed inset-0 z-20 h-full w-full rounded-none bg-background/80 md:hidden" aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} />}
    </div>
  </TooltipProvider>;
}