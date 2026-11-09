// Submits every public SEO route to IndexNow (Bing, Yandex, etc.).
// Usage: bunx tsx scripts/indexnow.ts
// The key file public/25897220cc9e3611b4980dbd33fdf59b.txt must be live on https://investmentsimulator.app.
import { BASE_URL, SEO_ROUTES } from "./seo-routes";

const KEY = "25897220cc9e3611b4980dbd33fdf59b";
const body = {
  host: new URL(BASE_URL).host,
  key: KEY,
  keyLocation: `${BASE_URL}/${KEY}.txt`,
  urlList: SEO_ROUTES.map((r) => `${BASE_URL}${r.path}`),
};

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});
console.log(`IndexNow: ${res.status} ${res.statusText} (${body.urlList.length} URLs)`);
console.log(await res.text());
if (res.status >= 400) process.exit(1);
