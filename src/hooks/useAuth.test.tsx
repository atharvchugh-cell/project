import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from './useAuth';

const auth = vi.hoisted(() => ({
  listener: undefined as undefined | ((event: string, session: { user: { id: string } } | null) => void),
  unsubscribe: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  getUser: auth.getUser,
  onAuthStateChange: (listener: typeof auth.listener) => {
    auth.listener = listener;
    return { data: { sub: undefined, subscription: { unsubscribe: auth.unsubscribe } } };
  },
} } }));

describe('optional account session', () => {
  beforeEach(() => { vi.clearAllMocks(); auth.listener = undefined; });
  it('restores the account from INITIAL_SESSION without a duplicate network lookup', () => {
    const { result, unmount } = renderHook(useAuth);
    act(() => auth.listener?.('INITIAL_SESSION', { user: { id: 'owner' } }));
    expect(result.current.user?.id).toBe('owner');
    expect(result.current.loading).toBe(false);
    expect(auth.getUser).not.toHaveBeenCalled();
    unmount();
    expect(auth.unsubscribe).toHaveBeenCalledOnce();
  });
  it('keeps guests available and clears the account on sign-out', () => {
    const { result } = renderHook(useAuth);
    act(() => auth.listener?.('INITIAL_SESSION', null));
    expect(result.current).toEqual({ user: null, loading: false });
    act(() => auth.listener?.('SIGNED_IN', { user: { id: 'owner' } }));
    act(() => auth.listener?.('SIGNED_OUT', null));
    expect(result.current).toEqual({ user: null, loading: false });
  });
});