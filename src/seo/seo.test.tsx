import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { render, waitFor, act } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { NOINDEX_ROUTES, SEO_ROUTES, resolveHead, BASE_URL, PUBLIC_ROBOTS } from "./routes";
import { RouteHead } from "./RouteHead";

const appSource = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
const ssrSource = readFileSync(resolve(__dirname, "../ssr-static.tsx"), "utf8");

describe("route registry", () => {
  it("has unique public paths and no overlap with private routes", () => {
    const paths = SEO_ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of NOINDEX_ROUTES) expect(paths).not.toContain(p.path);
  });

  it("lists 19 public routes, each declared in App.tsx and server-rendered", () => {
    expect(SEO_ROUTES).toHaveLength(19);
    for (const r of SEO_ROUTES) {
      const declared = appSource.includes(`path="${r.path}"`) || appSource.includes(`"${r.path}"`);
      expect(declared, r.path).toBe(true);
      expect(ssrSource.includes(`"${r.path}":`), `ssr ${r.path}`).toBe(true);
    }
  });

  it("never lists session or private routes in the sitemap source", () => {
    for (const r of SEO_ROUTES) {
      expect(r.path).not.toMatch(/\?|^\/(auth|account|play|join|host|share|admin|c\/|r\/|sandbox\/|client-contracts|unsubscribe)/);
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(0);
    }
  });

  it("classifies private, dynamic and unknown routes as noindex", () => {
    expect(resolveHead("/auth").kind).toBe("noindex");
    expect(resolveHead("/sandbox/setup").kind).toBe("noindex");
    expect(resolveHead("/c/ABC123").kind).toBe("dynamic-noindex");
    expect(resolveHead("/r/xyz").kind).toBe("dynamic-noindex");
    expect(resolveHead("/nope").kind).toBe("not-found");
    expect(resolveHead("/guide/").kind).toBe("public");
  });
});

let go: (p: string) => void = () => {};
function Nav() { go = useNavigate(); return null; }

const meta = (sel: string) => Array.from(document.head.querySelectorAll(sel));

describe("RouteHead after client navigation", () => {
  it("clears noindex when moving from a private page to a public one, and back", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/auth"]}>
          <Nav />
          <RouteHead />
        </MemoryRouter>
      </HelmetProvider>,
    );
    await waitFor(() => expect(meta('meta[name="robots"]')[0]?.getAttribute("content")).toBe("noindex,follow"));

    act(() => go("/for-teachers"));
    await waitFor(() => expect(meta('meta[name="robots"]')[0]?.getAttribute("content")).toBe(PUBLIC_ROBOTS));
    expect(meta('meta[name="robots"]')).toHaveLength(1);
    expect(meta('link[rel="canonical"]')).toHaveLength(1);
    expect(meta('link[rel="canonical"]')[0].getAttribute("href")).toBe(`${BASE_URL}/for-teachers`);
    expect(meta('meta[name="twitter:card"]')).toHaveLength(1);
    expect(meta('meta[property="og:image"]')[0].getAttribute("content")).toMatch(/^https:\/\//);

    act(() => go(-1 as unknown as string));
    await waitFor(() => expect(meta('meta[name="robots"]')[0]?.getAttribute("content")).toBe("noindex,follow"));
    expect(meta('link[rel="canonical"]')).toHaveLength(0);
  });
});
