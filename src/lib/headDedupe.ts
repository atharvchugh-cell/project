// Prerendered HTML ships one static set of head tags per route; Helmet then adds
// its own (marked data-rh). Whenever a Helmet tag exists, drop the static twin
// so the live DOM always has exactly one canonical/description/og/twitter tag.
const KEYS = [
  'link[rel="canonical"]',
  'meta[name="description"]',
  'meta[name="robots"]',
  ...["title", "description", "url", "type", "image"].map((k) => `meta[property="og:${k}"]`),
  ...["title", "description", "image", "card"].map((k) => `meta[name="twitter:${k}"]`),
];

function dedupe() {
  for (const sel of KEYS) {
    const all = Array.from(document.head.querySelectorAll(sel));
    if (all.length < 2) continue;
    const managed = all.filter((el) => el.hasAttribute("data-rh"));
    if (managed.length === 0) continue;
    all.forEach((el) => !el.hasAttribute("data-rh") && el.remove());
    managed.slice(0, -1).forEach((el) => el.remove());
  }
}

export function startHeadDedupe() {
  if (typeof document === "undefined") return;
  dedupe();
  new MutationObserver(dedupe).observe(document.head, { childList: true });
}
