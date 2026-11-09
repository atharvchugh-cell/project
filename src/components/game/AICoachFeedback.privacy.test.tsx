import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
const { invokeAI } = vi.hoisted(() => ({ invokeAI: vi.fn() }));
vi.mock('@/lib/aiInvoke', () => ({ invokeAI }));
import { AICoachFeedback } from './AICoachFeedback';
it('does not send game data until a player requests a review', async () => {
  invokeAI.mockResolvedValue({ overall: 'Test review', grade: 'C', strengths: [], improvements: [], counterfactuals: [], pivotalMoments: [], keyTakeaway: 'Test' });
  render(<AICoachFeedback payload={{ mode: 'stock', startYear: 2000, endYear: 2010, durationYears: 10, totalContributed: 5000, finalPortfolio: 6000, totalReturnPct: 20, cashLeftover: 6000, cashPctOfFinal: 100, assets: [] }} />);
  expect(invokeAI).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Request AI review' }));
  await waitFor(() => expect(invokeAI).toHaveBeenCalledOnce());
});