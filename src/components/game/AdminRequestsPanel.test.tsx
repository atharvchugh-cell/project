import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRequestsPanel } from './AdminRequestsPanel';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));

describe('admin feedback loading', () => {
  afterEach(cleanup);
  beforeEach(() => invoke.mockReset());

  it('loads feedback through the credential-checked endpoint with a bounded wait', async () => {
    invoke.mockResolvedValue({ data: { requests: [{ id: 'r1', message: 'A saved suggestion', status: 'new', created_at: '2026-10-24T00:00:00Z' }] }, error: null });
    render(<AdminRequestsPanel code="test-code" />);
    expect(await screen.findByText('A saved suggestion')).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith('feature-requests', { method: 'GET', headers: { 'x-admin-code': 'test-code' }, timeout: 15000 });
  });

  it('stops loading and permits retry when the service is unavailable', async () => {
    invoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 503 }) } });
    render(<AdminRequestsPanel code="test-code" />);
    await screen.findByRole('alert');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled());
  });
});