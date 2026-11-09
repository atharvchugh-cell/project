import { supabase } from '@/integrations/supabase/client';

/**
 * Total completed playthroughs, read from real game data via a
 * security-definer RPC (individual rows stay private).
 */
export async function fetchTotalPlaythroughs(): Promise<number | null> {
  try {
    const client = supabase as unknown as {
      rpc: (fn: string) => Promise<{ data: unknown; error: unknown }>;
    };
    const { data, error } = await client.rpc('get_total_playthroughs');
    if (error) return null;
    const n = typeof data === 'number' ? data : Number(data);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Round down to a friendly "1,200+" style figure. */
export function formatPlaythroughs(n: number): string {
  if (n >= 1000) {
    const rounded = Math.floor(n / 100) * 100;
    return `${rounded.toLocaleString()}+`;
  }
  return n.toLocaleString();
}
