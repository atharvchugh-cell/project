import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appOrigin } from '@/lib/basePath';

export default function Auth() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (user) navigate("/", { replace: true }); }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { emailRedirectTo: `${appOrigin()}/` },
      });
      if (error) setErr(error.message);
      else if (!data.session) setMsg("Check your email to confirm your account, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErr(error.message);
    }
    setBusy(false);
  };

  const google = async () => {
    setErr(null);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: appOrigin() + "/auth" });
    if (r.error) setErr(r.error.message ?? "Google sign-in failed");
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <Helmet>
        <title>Sign in — Rise to Riches</title>
        <meta name="description" content="Sign in or create a free Rise to Riches account to keep your game history and stats. Playing without an account stays free." />
        <meta name="robots" content="noindex,follow" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Sign in — Rise to Riches" />
        <meta property="og:description" content="Sign in or create a free Rise to Riches account to keep your game history and stats. Playing without an account stays free." />
        <meta property="og:url" content="https://investmentsimulator.app/auth" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Sign in — Rise to Riches" />
        <meta name="twitter:description" content="Sign in or create a free Rise to Riches account to keep your game history and stats. Playing without an account stays free." />
      </Helmet>
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="font-editorial text-4xl font-semibold">Rise to <span className="text-primary">Riches</span></Link>
          <h1 className="text-2xl font-semibold">{mode === "signin" ? "Sign in" : "Create a free account"}</h1>
          <p className="text-sm text-muted-foreground">Optional. Keep your game history and stats across devices. You can always play without an account.</p>
        </div>
        <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} /></div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          {msg && <p role="status" className="text-sm text-primary">{msg}</p>}
          <Button type="submit" className="w-full h-12 text-base font-medium" disabled={busy}>{busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
        </form>
        {mode === "signup" && <p className="text-center text-xs text-muted-foreground">By creating an account you agree to the <Link to="/terms" className="text-primary underline">Terms</Link> and <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.</p>}
        <p className="text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button className="text-primary underline-offset-4 hover:underline" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); setMsg(null); }}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
        <p className="text-center"><Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Keep playing as a guest →</Link></p>
      </div>
    </main>
  );
}
