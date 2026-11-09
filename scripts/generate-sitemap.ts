// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.
//
// Route list comes from scripts/seo-routes.ts. <lastmod> is the last git commit
// date of each route's own source files; omitted when git history is unavailable.

import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { BASE_URL, SEO_ROUTES } from "./seo-routes";

/** Latest git commit date touching any of the route's source files, or null. */
function lastmod(sources: string[]): string | null {
  try {
    const out = execSync(`git log -1 --format=%cs -- ${sources.map((s) => `"${s}"`).join(" ")}`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

const urls = SEO_ROUTES.map((route) => {
  const mod = lastmod(route.sources);
  return [
    `  <url>`,
    `    <loc>${BASE_URL}${route.path}</loc>`,
    ...(mod ? [`    <lastmod>${mod}</lastmod>`] : []),
    `    <changefreq>${route.changefreq}</changefreq>`,
    `    <priority>${route.priority}</priority>`,
    `  </url>`,
  ].join("\n");
});

const xml = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ...urls,
  `</urlset>`,
  ``,
].join("\n");

writeFileSync(resolve("public/sitemap.xml"), xml);
console.log(`sitemap.xml written (${SEO_ROUTES.length} entries)`);
