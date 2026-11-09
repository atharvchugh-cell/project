// Pure error handling shared by existing gateway calls; no retries or model changes.
interface ErrorHooks {
  refund: () => Promise<void>;
  pause: () => Promise<void>;
}

export async function gatewayFailure(response: Response, hooks: ErrorHooks) {
  let payload: Record<string, unknown> = {};
  try { payload = await response.json(); } catch { /* use safe status fallback */ }
  const nested = payload.error && typeof payload.error === "object"
    ? payload.error as Record<string, unknown> : {};
  const type = String(payload.type ?? nested.type ?? payload.code ?? nested.code ?? "");
  const workspaceBlock = response.status === 403 &&
    ["credit_limit_reached", "ai_disabled", "workspace_ai_disabled"].includes(type);
  const payment = response.status === 402;
  if (payment || workspaceBlock || response.status === 429 || response.status >= 500) {
    await hooks.refund();
  }
  if (payment || workspaceBlock) await hooks.pause();
  const upstream = payload.message ?? nested.message ?? (typeof payload.error === "string" ? payload.error : null);
  const fallback = payment
    ? "AI credits are unavailable. The site owner can check Settings → Plans & credits."
    : response.status === 429
      ? "AI is busy. Please try again later."
      : "AI is temporarily unavailable. Please try again later.";
  const headers: Record<string, string> = {};
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) headers["Retry-After"] = retryAfter;
  return {
    status: response.status,
    body: { error: typeof upstream === "string" && upstream.trim() ? upstream : fallback },
    headers,
  };
}