import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

describe('public leaderboard request budget', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    rpc.mockReset();
    rpc.mockResolvedValue({ data: [], error: null });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('reuses results until the two-hour boundary', async () => {
    const { fetchLeaderboard } = await import('./leaderboard');
    await fetchLeaderboard();
    await vi.advanceTimersByTimeAsync(7_199_999);
    await fetchLeaderboard();
    expect(rpc).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await fetchLeaderboard();
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('shares simultaneous reads and keeps filters independent', async () => {
    const { fetchLeaderboard } = await import('./leaderboard');
    await Promise.all([fetchLeaderboard(), fetchLeaderboard({ kind: 'all' })]);
    expect(rpc).toHaveBeenCalledTimes(1);
    await fetchLeaderboard({ kind: 'solo' });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith('get_leaderboard', expect.objectContaining({ p_kind: 'solo' }));
  });

  it('lets explicit retry bypass recent results', async () => {
    const { fetchLeaderboard } = await import('./leaderboard');
    await fetchLeaderboard();
    await fetchLeaderboard({}, true);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('does not fetch again after 20 seconds or repeated focus events', async () => {
    const { useLeaderboard } = await import('./leaderboard');
    renderHook(() => useLeaderboard({}));
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(7_180_000); });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});