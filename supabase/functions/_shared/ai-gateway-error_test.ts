import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { gatewayFailure } from "./ai-gateway-error.ts";

async function check(status: number, payload: unknown) {
  let refunds = 0, pauses = 0;
  const result = await gatewayFailure(new Response(JSON.stringify(payload), { status }), {
    refund: async () => { refunds++; }, pause: async () => { pauses++; },
  });
  return { result, refunds, pauses };
}

Deno.test("402 restores player allowance, pauses AI, and preserves payment remedy", async () => {
  const { result, refunds, pauses } = await check(402, { message: "Add credits in Settings → Plans & credits." });
  assertEquals(result.status, 402);
  assertEquals(result.body.error, "Add credits in Settings → Plans & credits.");
  assertEquals(refunds, 1);
  assertEquals(pauses, 1);
});
Deno.test("workspace spending cap pauses without turning 403 into 500", async () => {
  const { result, refunds, pauses } = await check(403, { type: "credit_limit_reached", message: "Ask a workspace admin to raise the AI limit." });
  assertEquals(result.status, 403);
  assertEquals(refunds, 1);
  assertEquals(pauses, 1);
});
Deno.test("provider access error preserves denial and never treats it as credit exhaustion", async () => {
  const { result, pauses } = await check(403, { error: { message: "Provider access denied." } });
  assertEquals(result.status, 403);
  assertEquals(result.body.error, "Provider access denied.");
  assertEquals(pauses, 0);
});
Deno.test("transient failures refund but do not persist a credit pause", async () => {
  for (const status of [429, 500, 503]) {
    const { result, refunds, pauses } = await check(status, {});
    assertEquals(result.status, status);
    assertEquals(refunds, 1);
    assertEquals(pauses, 0);
  }
});