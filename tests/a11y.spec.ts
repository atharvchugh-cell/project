import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../playwright-fixture";

/**
 * Accessibility regression suite. Runs axe-core against the homepage,
 * the Guide page, and the Real Estate route, failing CI on any new
 * critical/serious issue — primarily contrast, heading order, and
 * skip-link findings.
 *
 * Tags are restricted to WCAG 2.1 A/AA + best-practice rules.
 */
const ROUTES = ["/", "/guide", "/real-estate-game"];

for (const path of ROUTES) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    if (blocking.length > 0) {
      console.log(
        "Axe violations:\n" +
          blocking
            .map(
              (v) =>
                `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${
                  v.nodes.length === 1 ? "" : "s"
                })\n    ${v.helpUrl}`,
            )
            .join("\n"),
      );
    }

    expect(blocking, "no critical or serious axe violations").toEqual([]);
  });
}
