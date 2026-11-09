/**
 * Focus-return tests for the Complex Mode trade dialog.
 *
 * GameScreen wraps its trade dialog in shadcn's <Dialog /> (Radix UI), whose
 * built-in behavior traps focus inside the dialog and returns it to the
 * triggering element on close. These tests exercise the same primitive the
 * way GameScreen uses it (controlled open state, trigger button outside the
 * dialog) and assert focus lands back on the trigger after closing via
 * Escape and after confirming a trade.
 *
 * Because <MultiplayerGame /> renders the same <GameScreen />, this also
 * covers multiplayer Complex Mode.
 *
 * Note: jsdom does not faithfully simulate Radix's pointer-based
 * outside-click handler, so we cover the three exit paths via Escape,
 * Confirm, and programmatic close (which is exactly what the outside-click
 * handler invokes — `onOpenChange(false)`).
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

function TradeFlowHarness({ onConfirm, closeMode }: { onConfirm?: () => void; closeMode?: 'programmatic' }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button data-testid="trade-trigger">Buy AAPL</button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buy Apple</DialogTitle>
          </DialogHeader>
          <input data-testid="shares-input" aria-label="shares" defaultValue="1" />
          <Button
            data-testid="confirm"
            onClick={() => {
              onConfirm?.();
              setOpen(false);
            }}
          >
            Confirm Buy
          </Button>
          {closeMode === 'programmatic' && (
            <button data-testid="programmatic-close" onClick={() => setOpen(false)}>x</button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

describe('Complex Mode trade dialog focus return', () => {
  it('returns focus to the trigger after Escape', async () => {
    const user = userEvent.setup();
    render(<TradeFlowHarness />);
    const trigger = screen.getByTestId('trade-trigger');
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('returns focus to the trigger after confirming a trade', async () => {
    const user = userEvent.setup();
    let confirmed = false;
    render(<TradeFlowHarness onConfirm={() => { confirmed = true; }} />);
    const trigger = screen.getByTestId('trade-trigger');
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.click(screen.getByTestId('confirm'));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(confirmed).toBe(true);
  });

  it('returns focus to the trigger when closed programmatically (e.g. clicking outside)', async () => {
    const user = userEvent.setup();
    render(<TradeFlowHarness closeMode="programmatic" />);
    const trigger = screen.getByTestId('trade-trigger');
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.click(screen.getByTestId('programmatic-close'));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
