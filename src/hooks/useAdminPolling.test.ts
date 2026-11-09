import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminPolling } from './useAdminPolling';

describe('admin report refresh budget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('does not request reports when automatic refresh is off', () => {
    const refresh = vi.fn();
    renderHook(() => useAdminPolling(false, refresh));
    act(() => vi.advanceTimersByTime(3_600_000));
    expect(refresh).not.toHaveBeenCalled();
  });
  it('waits 15 minutes rather than polling every 30 seconds', () => {
    const refresh = vi.fn();
    renderHook(() => useAdminPolling(true, refresh));
    act(() => vi.advanceTimersByTime(899_999));
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('skips hidden tabs and cleans up after leaving', () => {
    const refresh = vi.fn();
    const hook = renderHook(() => useAdminPolling(true, refresh));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => vi.advanceTimersByTime(900_000));
    expect(refresh).not.toHaveBeenCalled();
    hook.unmount();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => vi.advanceTimersByTime(900_000));
    expect(refresh).not.toHaveBeenCalled();
  });
  it('enabling polling does not trigger an extra initial report', () => {
    const refresh = vi.fn();
    const hook = renderHook(({ enabled }) => useAdminPolling(enabled, refresh), { initialProps: { enabled: false } });
    hook.rerender({ enabled: true });
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(900_000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});