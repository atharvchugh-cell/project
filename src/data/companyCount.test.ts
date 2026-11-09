import { describe, expect, it } from "vitest";
import { COMPANY_COUNT } from "./companyCount";
import { COMPANY_COUNT as REAL } from "./complexReturns";

describe("company count shown on the homepage", () => {
  it("matches the Advanced-mode universe", () => {
    expect(COMPANY_COUNT).toBe(REAL);
    expect(COMPANY_COUNT).toBe(166);
  });
});
