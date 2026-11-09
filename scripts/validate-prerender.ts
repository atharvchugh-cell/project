import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { JSDOM } from "jsdom";
import { BASE_URL, SEO_ROUTES, NOINDEX_ROUTES, PUBLIC_ROBOTS } from "./seo-routes";

export function validatePrerender(dist: string) {
  let checked = 0;
  const publicPaths = new Set(SEO_ROUTES.map(r => r.path));
  const privatePaths = new Set(NOINDEX_ROUTES.map(r => r.path));
  function require(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(`prerender validation: ${message}`);
  }
  for (const route of SEO_ROUTES) {
    const file = join(dist, route.path, "index.html");
    const doc = new JSDOM(readFileSync(file, "utf8")).window.document;
    const one = (selector: string) => {
      const nodes = doc.head.querySelectorAll(selector);
      require(nodes.length === 1, `${route.path}: expected one ${selector}, found ${nodes.length}`);
      return nodes[0];
    };
    require(one("title").textContent === route.title, `${route.path}: title parity`);
    require(one('meta[name="description"]').getAttribute("content") === route.description, `${route.path}: description parity`);
    require(one('link[rel="canonical"]').getAttribute("href") === `${BASE_URL}${route.path}`, `${route.path}: canonical parity`);
    require(one('meta[name="robots"]').getAttribute("content") === PUBLIC_ROBOTS, `${route.path}: public robots`);
    for (const key of ["og:image", "og:title", "og:description", "og:url"]) one(`meta[property="${key}"]`);
    for (const key of ["twitter:image", "twitter:title", "twitter:description", "twitter:card"]) one(`meta[name="${key}"]`);
    for (const node of doc.querySelectorAll('script[type="application/ld+json"]')) JSON.parse(node.textContent ?? "");
    const root = doc.querySelector("#root");
    require(root?.querySelector("h1"), `${route.path}: real page heading missing`);
    const words = root?.textContent?.trim().split(/\s+/).length ?? 0;
    require(words >= (route.path === "/leaderboard" ? 30 : route.path === "/contact" ? 60 : 100), `${route.path}: insufficient real body (${words} words)`);
    for (const a of root?.querySelectorAll("a[href]") ?? []) {
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const path = new URL(href, BASE_URL).pathname.replace(/\/$/, "") || "/";
      require(publicPaths.has(path) || privatePaths.has(path) || /^\/(c|r)\//.test(path) || existsSync(join(dist, path)), `${route.path}: unresolved internal link ${href}`);
    }
    checked++;
  }
  for (const route of NOINDEX_ROUTES) {
    const doc = new JSDOM(readFileSync(join(dist, route.path, "index.html"), "utf8")).window.document;
    require(doc.querySelectorAll('meta[name="robots"]').length === 1, `${route.path}: duplicate robots`);
    require(doc.querySelector('meta[name="robots"]')?.getAttribute("content") === "noindex,follow", `${route.path}: private robots`);
    require(!doc.querySelector('link[rel="canonical"]'), `${route.path}: unexpected canonical`);
  }
  const missing = new JSDOM(readFileSync(join(dist, "404.html"), "utf8")).window.document;
  require(missing.querySelector('meta[name="robots"]')?.getAttribute("content") === "noindex,follow", "404 robots");
  require(!missing.querySelector('link[rel="canonical"],script[type="application/ld+json"]'), "404 canonical/schema leakage");
  require(missing.querySelector('#root a[href="/"]') && missing.querySelector('#root a[href="/learn"]'), "404 shared navigation missing");
  const sitemap = new JSDOM(readFileSync(resolve("public/sitemap.xml"), "utf8"), { contentType: "text/xml" }).window.document;
  const locs = [...sitemap.querySelectorAll("loc")].map(n => n.textContent);
  require(locs.length === 19 && new Set(locs).size === 19, "sitemap count/duplicates");
  require(SEO_ROUTES.every(r => locs.includes(`${BASE_URL}${r.path}`)), "sitemap parity");
  console.log(`prerender validation: ${checked} public heads/bodies/links, ${NOINDEX_ROUTES.length} private heads, 404 and 19-URL sitemap passed`);
}