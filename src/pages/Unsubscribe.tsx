import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, { headers: { apikey: SUPABASE_ANON } });
        const data = await res.json();
        if (res.ok && data.valid) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch { setState("error"); }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok && data.success) setState("success");
      else if (data.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch { setState("error"); }
    setSubmitting(false);
  };

  return (
    <>
      <Helmet>
        <title>Unsubscribe — Rise to Riches</title>
        <meta
          name="description"
          content="Manage your Rise to Riches email preferences and unsubscribe from future stock simulator updates in one click."
        />
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card/40 p-8 text-center">
          <h1 className="text-2xl font-semibold mb-4">Email preferences</h1>
          {state === "loading" && <p className="text-muted-foreground">Verifying your link…</p>}
          {state === "valid" && (
            <>
              <p className="mb-6 text-muted-foreground">Click below to unsubscribe from Rise to Riches emails.</p>
              <button onClick={confirm} disabled={submitting} className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition disabled:opacity-50">
                {submitting ? "Unsubscribing…" : "Confirm unsubscribe"}
              </button>
            </>
          )}
          {state === "success" && <p>You've been unsubscribed. You won't receive further emails.</p>}
          {state === "already" && <p>This address is already unsubscribed.</p>}
          {state === "invalid" && <p className="text-destructive">This link is invalid or expired.</p>}
          {state === "error" && <p className="text-destructive">Something went wrong. Please try again later.</p>}
        </div>
      </main>
    </>
  );
};

export default Unsubscribe;
