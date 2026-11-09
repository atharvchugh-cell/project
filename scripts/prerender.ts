// Runs after `vite build` (postbuild hook).
//
// The app is a client-rendered Vite SPA, so every route ships dist/index.html —
// which means crawlers see the homepage <title>, description and JSON-LD on
// /guide, /for-teachers and every other page until React and Helmet boot.
// Google can execute JavaScript but recommends static rendering where possible.
//
// This step writes a real static HTML file per indexable route with that
// route's own head tags plus a static heading/summary/link block inside #root.
// React's createRoot clears the container on mount, so hydration output is
// unchanged and no game behaviour is affected.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { pathToFileURL } from "url";
import { BASE_URL, DEFAULT_IMAGE, NOINDEX_ROUTES, NOT_FOUND_HEAD, PUBLIC_ROBOTS, SEO_ROUTES, type SeoRoute } from "./seo-routes";
import { validatePrerender } from "./validate-prerender";

const DIST = resolve("dist");
const TEMPLATE_PATH = join(DIST, "index.html");

if (!existsSync(TEMPLATE_PATH)) {
  console.error("prerender: dist/index.html not found — run vite build first.");
  process.exit(1);
}


const template = readFileSync(TEMPLATE_PATH, "utf8");

const escapeAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Head tags that are per-page and must not leak from the homepage template. */
const PER_PAGE_TAG_PATTERNS: RegExp[] = [
  /<title>[\s\S]*?<\/title>\s*/i,
  /<meta\s+name="description"[^>]*>\s*/gi,
  /<meta\s+property="og:(?:title|description|url|type|image|image:width|image:height|image:alt)"[^>]*>\s*/gi,
  /<meta\s+name="twitter:(?:card|site|title|description|url|image|image:alt)"[^>]*>\s*/gi,
  /<link\s+rel="canonical"[^>]*>\s*/gi,
  /<meta\s+name="robots"[^>]*>\s*/gi,
];

/** JSON-LD blocks that describe the homepage specifically. */
const PAGE_SPECIFIC_SCHEMA_TYPES = ["VideoGame", "WebApplication", "FAQPage", "Course"];

function stripPageSpecificSchema(html: string) {
  return html.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>\s*/gi,
    (match, body: string) =>
      PAGE_SPECIFIC_SCHEMA_TYPES.some((type) => new RegExp(`"@type"\\s*:\\s*"${type}"`).test(body))
        ? ""
        : match,
  );
}

function headFor(route: SeoRoute) {
  const url = `${BASE_URL}${route.path}`;
  const image = route.image ?? DEFAULT_IMAGE;
  const title = escapeAttr(route.title);
  const description = escapeAttr(route.description);

  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${PUBLIC_ROBOTS}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${route.ogType}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${title}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ]
    .map((tag) => `    ${tag}`)
    .join("\n");
}

// Real server-rendered markup for static content pages (same components visitors get).
const SSR_ENTRY = resolve("dist-ssr", "ssr-static.js");
const ssr: { render?: (path: string) => { body: string; scripts: string } | null } = existsSync(SSR_ENTRY)
  ? await import(pathToFileURL(SSR_ENTRY).href)
  : {};

function renderRoute(route: SeoRoute) {
  let html = template;

  for (const pattern of PER_PAGE_TAG_PATTERNS) html = html.replace(pattern, "");
  if (route.path !== "/") html = stripPageSpecificSchema(html);

  // Static content pages get their real rendered markup; everything else keeps
  // the shared loading skeleton. No crawler-only copy is injected.
  const rendered = ssr.render?.(route.path);
  const scripts = rendered?.scripts ? `\n    ${rendered.scripts}` : "";
  html = html.replace(/<\/head>/i, `${headFor(route)}${scripts}\n  </head>`);
  const body = rendered?.body;
  if (body) {
    const start = html.indexOf('<div id="root">');
    const end = html.indexOf("<!--root-end-->");
    if (start !== -1 && end > start) html = `${html.slice(0, start)}<div id="root">${body}</div>${html.slice(end)}`;
  }

  const outPath =
    route.path === "/" ? join(DIST, "index.html") : join(DIST, route.path.replace(/^\//, ""), "index.html");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  return outPath;
}

function renderNoindex(path: string, title: string, description: string) {
  let html = template;
  for (const pattern of PER_PAGE_TAG_PATTERNS) html = html.replace(pattern, "");
  html = stripPageSpecificSchema(html);
  const url = `${BASE_URL}${path}`;
  const tags = [
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<meta name="robots" content="noindex,follow" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
  ]
    .map((tag) => `    ${tag}`)
    .join("\n");
  html = html.replace(/<\/head>/i, `${tags}\n  </head>`);
  const outPath = join(DIST, path.replace(/^\//, ""), "index.html");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
}

for (const r of NOINDEX_ROUTES) {
  renderNoindex(r.path, r.title, r.description);
  console.log(`prerendered (noindex) ${r.path}`);
}

for (const route of SEO_ROUTES) {
  const out = renderRoute(route);
  console.log(`prerendered ${route.path} -> ${out.replace(`${DIST}/`, "dist/")}`);
}
// Artifact only: Lovable's SPA catch-all is not configurable through this file.
// No canonical or homepage/identity schemas belong on a missing-page document.
let missing = template;
for (const pattern of PER_PAGE_TAG_PATTERNS) missing = missing.replace(pattern, "");
missing = missing.replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi, "");
missing = missing.replace(/<\/head>/i, `<title>${escapeAttr(NOT_FOUND_HEAD.title)}</title><meta name="description" content="${escapeAttr(NOT_FOUND_HEAD.description)}" /><meta name="robots" content="noindex,follow" /></head>`);
const missingBody = ssr.render?.("/404.html")?.body;
if (!missingBody) throw new Error("prerender: same-component NotFound output is missing");
const missingStart = missing.indexOf('<div id="root">');
const missingEnd = missing.indexOf("<!--root-end-->");
if (missingStart === -1 || missingEnd <= missingStart) throw new Error("prerender: root markers missing");
missing = `${missing.slice(0, missingStart)}<div id="root">${missingBody}</div>${missing.slice(missingEnd)}`;
writeFileSync(join(DIST, "404.html"), missing);
console.log(`prerender: ${SEO_ROUTES.length} routes written`);
validatePrerender(DIST);
