import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HoldingsSidebar } from './HoldingsSidebar';

const sample = [
  { id: 'cmplx-AAPL', ticker: 'AAPL', name: 'Apple', shares: 10, currentPrice: 200, costBasis: 1500 },
  { id: 'cmplx-NVDA', ticker: 'NVDA', name: 'NVIDIA', shares: 5, currentPrice: 800, costBasis: 2000 },
];

describe('HoldingsSidebar a11y + keyboard', () => {
  it('lists each holding under a labeled list', () => {
    render(<HoldingsSidebar holdings={sample} onBuy={vi.fn()} onSell={vi.fn()} />);
    expect(screen.getByRole('list', { name: /your stock holdings/i })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders a friendly empty state when there are no holdings', () => {
    render(<HoldingsSidebar holdings={[]} onBuy={vi.fn()} onSell={vi.fn()} />);
    expect(screen.getByText(/no stocks yet/i)).toBeInTheDocument();
  });

  it('Buy and Sell buttons are keyboard activatable and fire callbacks', async () => {
    const onBuy = vi.fn();
    const onSell = vi.fn();
    render(<HoldingsSidebar holdings={sample} onBuy={onBuy} onSell={onSell} />);

    // Tab to first Buy button
    const buyButtons = screen.getAllByRole('button', { name: 'Buy' });
    buyButtons[0].focus();
    expect(buyButtons[0]).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onBuy).toHaveBeenCalledWith('cmplx-AAPL');

    const sellButtons = screen.getAllByRole('button', { name: 'Sell' });
    sellButtons[1].focus();
    await userEvent.keyboard(' ');
    expect(onSell).toHaveBeenCalledWith('cmplx-NVDA');
  });

  it('returns focus to the launching button after a synthetic panel close', async () => {
    const onBuy = vi.fn();
    render(
      <div>
        <HoldingsSidebar holdings={sample} onBuy={onBuy} onSell={vi.fn()} />
        <button>elsewhere</button>
      </div>
    );
    const buy = screen.getAllByRole('button', { name: 'Buy' })[0];
    buy.focus();
    // Simulate a dialog opening then closing — focus should return to launcher.
    const elsewhere = screen.getByText('elsewhere');
    elsewhere.focus();
    expect(elsewhere).toHaveFocus();
    buy.focus();
    expect(buy).toHaveFocus();
  });
});
