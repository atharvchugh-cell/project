import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import { JSDOM } from "jsdom";
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { resolve, dirname } from "path";
import ts from "typescript";
import { render } from "../ssr-static";
import { SEO_ROUTES, BASE_URL, NOINDEX_ROUTES } from "./routes";

describe("same-component initial rendering", () => {
  beforeAll(() => { HelmetProvider.canUseDOM = false; });
  afterAll(() => { HelmetProvider.canUseDOM = true; });
  it.each(SEO_ROUTES)("renders real content and valid structured data for $path", route => {
    const result = render(route.path);
    expect(result).not.toBeNull();
    const doc = new JSDOM(`<head>${result?.scripts}</head><body>${result?.body}</body>`).window.document;
    expect(doc.querySelector("h1")).not.toBeNull();
    expect(doc.body.textContent?.trim().split(/\s+/).length).toBeGreaterThanOrEqual(route.path === "/leaderboard" ? 30 : route.path === "/contact" ? 60 : 100);
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) expect(() => JSON.parse(script.textContent ?? "")).not.toThrow();
    const allowed = new Set([...SEO_ROUTES, ...NOINDEX_ROUTES].map(r => r.path));
    for (const link of doc.querySelectorAll('a[href^="/"]')) {
      const path = new URL(link.getAttribute("href") ?? "/", BASE_URL).pathname.replace(/\/$/, "") || "/";
      expect(allowed.has(path) || /^\/(c|r)\//.test(path) || existsSync(resolve("public", `.${path}`)), `${route.path} → ${path}`).toBe(true);
    }
  });

  it("renders the actual missing-page component without homepage application schema", () => {
    const result = render("/404.html");
    const doc = new JSDOM(result?.body).window.document;
    expect(doc.querySelector('a[href="/"]')).not.toBeNull();
    expect(doc.querySelector('a[href="/learn"]')).not.toBeNull();
    expect(result?.scripts).not.toContain('"@type":"WebApplication"');
  });

  it("runs the actual prerender writer and validates all initial heads, private routes and the 404 artifact", () => {
    const fixture = mkdtempSync(`${tmpdir()}/seo-prerender-`);
    try {
      for (const name of ["dist", "dist-ssr", "public"]) mkdirSync(`${fixture}/${name}`);
      copyFileSync(resolve("index.html"), `${fixture}/dist/index.html`);
      copyFileSync(resolve("public/sitemap.xml"), `${fixture}/public/sitemap.xml`);
      const rendered = Object.fromEntries([...SEO_ROUTES.map(r => r.path), "/404.html"].map(p => [p, render(p)]));
      writeFileSync(`${fixture}/dist-ssr/ssr-static.js`, `exports.render = p => (${JSON.stringify(rendered)})[p] ?? null;`);
      const output = execFileSync(resolve("node_modules/.bin/tsx"), [resolve("scripts/prerender.ts")], { cwd: fixture, encoding: "utf8" });
      expect(output).toContain("19 public heads/bodies/links");
      const missing = new JSDOM(readFileSync(`${fixture}/dist/404.html`, "utf8")).window.document;
      expect(missing.querySelector("title")?.textContent).toContain("not found");
      expect(missing.querySelector('link[rel="canonical"]')).toBeNull();
      const home = new JSDOM(readFileSync(`${fixture}/dist/index.html`, "utf8")).window.document;
      expect(home.head.querySelectorAll("title")).toHaveLength(1);
      expect(home.querySelector('meta[name="google-site-verification"]')).not.toBeNull();
    } finally { rmSync(fixture, { recursive: true, force: true }); }
  }, 30000);

  it("connects homepage application identity to the site and publisher without fabricated ratings", () => {
    const result = render("/");
    const doc = new JSDOM(result?.scripts).window.document;
    const data = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent ?? ""));
    const application = data.find(s => s["@type"] === "WebApplication");
    expect(application?.["@id"]).toBe(`${BASE_URL}/#application`);
    expect(application?.publisher?.["@id"]).toBe(`${BASE_URL}/#organization`);
    expect(application?.isPartOf?.["@id"]).toBe(`${BASE_URL}/#website`);
    expect(application?.offers?.price).toBe("0");
    expect(application?.aggregateRating).toBeUndefined();
  });

  it("keeps stock engine and return datasets outside the homepage's static import graph", () => {
    const visited = new Set<string>();
    function visit(file: string) {
      if (visited.has(file)) return;
      visited.add(file);
      const text = readFileSync(file, "utf8");
      const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      for (const node of ast.statements) {
        if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.importClause?.isTypeOnly) continue;
        if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && !node.importClause.name && node.importClause.namedBindings.elements.every(e => e.isTypeOnly)) continue;
        const name = node.moduleSpecifier.text;
        const base = name.startsWith("@/") ? resolve("src", name.slice(2)) : name.startsWith(".") ? resolve(dirname(file), name) : null;
        if (!base) continue;
        const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(p => existsSync(p) && /\.(ts|tsx)$/.test(p));
        if (target) visit(target);
      }
    }
    visit(resolve("src/pages/Index.tsx"));
    for (const blocked of ["src/lib/stockEngine.ts", "src/hooks/useGameEngine.ts", "src/data/historicalData.ts", "src/data/complexReturns.ts", "src/data/stockPool.ts"]) expect(visited.has(resolve(blocked)), blocked).toBe(false);
  });
});