import { beforeEach, expect, it, vi } from 'vitest';
const { invoke, insert } = vi.hoisted(() => ({ invoke: vi.fn(), insert: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke }, from: () => ({ insert }) } }));
import { trackGameEvent } from './analytics';
import { savePrivacyChoice } from './privacy';
beforeEach(() => { localStorage.clear(); invoke.mockReset(); insert.mockReset(); invoke.mockResolvedValue({ data: { ok: true, trace_id: 'QA' }, error: null }); });
it('never sends optional events before acceptance, after rejection or after withdrawal', async () => {
  await trackGameEvent({ completed: true }, 'analytics');
  savePrivacyChoice(false); await trackGameEvent({ completed: true }, 'analytics');
  savePrivacyChoice(true); savePrivacyChoice(false); await trackGameEvent({ completed: true }, 'analytics');
  expect(invoke).not.toHaveBeenCalled(); expect(insert).not.toHaveBeenCalled();
});
it('keeps requested submissions independent of optional collection', async () => {
  savePrivacyChoice(true); await trackGameEvent({ completed: true }, 'analytics');
  expect(invoke).toHaveBeenCalledOnce();
  savePrivacyChoice(false); await trackGameEvent({ completed: true, display_name: 'Chosen alias' });
  expect(invoke).toHaveBeenCalledTimes(2); expect(invoke.mock.calls[1][1].body.referrer).toBeNull();
});