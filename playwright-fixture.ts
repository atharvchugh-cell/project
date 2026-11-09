// Re-export the base fixture from the package
// Override or extend test/expect here if needed
//
// The Lovable fixture package only exists inside Lovable's sandbox; elsewhere
// fall back to the stock Playwright fixture so the same specs run in CI.
import * as playwright from "@playwright/test";

type Fixtures = Pick<typeof playwright, "test" | "expect">;

async function loadFixtures(): Promise<Fixtures> {
  try {
    return (await import("lovable-agent-playwright-config/fixture")) as Fixtures;
  } catch {
    return playwright;
  }
}

const fixtures = await loadFixtures();

export const test = fixtures.test;
export const expect = fixtures.expect;
