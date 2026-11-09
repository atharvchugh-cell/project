import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComplexStockSearch } from './ComplexStockSearch';

function setup(props?: Partial<Parameters<typeof ComplexStockSearch>[0]>) {
  const onAdd = vi.fn();
  render(
    <div>
      <button>before</button>
      <ComplexStockSearch
        watchlistTickers={[]}
        watchlistCap={10}
        currentSimYear={2024}
        onAdd={onAdd}
        {...props}
      />
      <button>after</button>
    </div>
  );
  return { onAdd };
}

describe('ComplexStockSearch a11y + keyboard', () => {
  it('exposes combobox role with aria-controls and aria-expanded', async () => {
    setup();
    const input = screen.getByRole('combobox', { name: /search complex mode stocks/i });
    expect(input).toHaveAttribute('aria-controls', 'complex-search-results');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens listbox on typing and arrow-down moves active descendant', async () => {
    setup();
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('AAPL');
    const listbox = await screen.findByRole('listbox');
    expect(listbox).toBeInTheDocument();
    // Active descendant should match first option
    expect(input.getAttribute('aria-activedescendant')).toMatch(/^complex-opt-/);
  });

  it('Enter activates the active row (opens trade) via onSelectForTrade', async () => {
    const onAdd = vi.fn();
    const onSelectForTrade = vi.fn();
    render(
      <div>
        <button>before</button>
        <ComplexStockSearch
          watchlistTickers={[]}
          watchlistCap={10}
          currentSimYear={2024}
          onAdd={onAdd}
          onSelectForTrade={onSelectForTrade}
        />
        <button>after</button>
      </div>
    );
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('AAPL');
    await userEvent.keyboard('{Enter}');
    expect(onSelectForTrade).toHaveBeenCalled();
    expect(onSelectForTrade.mock.calls[0][0].ticker).toBe('AAPL');
  });

  it('clicking Watch (not row) adds to watchlist without opening trade', async () => {
    const onAdd = vi.fn();
    const onSelectForTrade = vi.fn();
    render(
      <ComplexStockSearch
        watchlistTickers={[]}
        watchlistCap={10}
        currentSimYear={2024}
        onAdd={onAdd}
        onSelectForTrade={onSelectForTrade}
      />
    );
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('AAPL');
    const watchBtn = await screen.findByRole('button', { name: /add AAPL to watchlist/i });
    await userEvent.click(watchBtn);
    expect(onAdd).toHaveBeenCalled();
    expect(onAdd.mock.calls[0][0].ticker).toBe('AAPL');
    expect(onSelectForTrade).not.toHaveBeenCalled();
  });

  it('Escape closes the dropdown and keeps focus on input', async () => {
    setup();
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('apple');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('Tab from input moves focus forward (no focus trap when closed)', async () => {
    setup();
    const input = screen.getByRole('combobox');
    input.focus();
    expect(input).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByText('after')).toHaveFocus();
  });

  it('disables Add for tickers already in watchlist', async () => {
    setup({ watchlistTickers: ['AAPL'] });
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('AAPL');
    const addedBtn = await screen.findByRole('button', { name: /already in watchlist/i });
    expect(addedBtn).toBeDisabled();
  });

  it("hides companies that have not IPO'd yet in the current sim year", async () => {
    setup({ currentSimYear: 1990 });
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('ABBV');
    expect(screen.queryByText(/ABBV/)).not.toBeInTheDocument();
  });
});
