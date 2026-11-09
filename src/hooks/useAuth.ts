import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Optional account state. Guests get `user === null` and keep full access. */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    // INITIAL_SESSION supplies the restored session. Avoid a second network
    // user lookup holding the auth lock while account queries need it.
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}
