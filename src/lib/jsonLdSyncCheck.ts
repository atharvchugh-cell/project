/**
 * Dev-time guard: verifies the JSON-LD structured data emitted into <head>
 * actually matches what's rendered in the DOM. No-op in production.
 *
 * Usage:
 *   useJsonLdSyncCheck({
 *     enabled: !loading,
 *     expected: { webPage: webPageJsonLd, itemList: itemListJsonLd },
 *     rowSelector: '[data-leaderboard-row]',
 *     rowNameAttr: 'data-leaderboard-name',
 *   });
 *
 * Logs a single grouped console.error per mismatch. Catches drift between
 * the rendered list and the structured data (e.g. filter changed but
 * JSON-LD memo wasn't invalidated, or row count diverges).
 */
import { useEffect } from 'react';

type ListItem = { '@type': string; position: number; name: string };
type ItemList = {
  '@type': string;
  numberOfItems?: number;
  itemListElement?: ListItem[];
};
type WebPage = { '@type': string; url?: string };

interface Args {
  enabled: boolean;
  expected: { webPage: WebPage; itemList: ItemList };
  rowSelector: string;
  rowNameAttr: string;
}

export function useJsonLdSyncCheck({ enabled, expected, rowSelector, rowNameAttr }: Args) {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!enabled) return;
    if (typeof document === 'undefined') return;

    // Helmet writes async — wait a tick so head is updated.
    const id = window.setTimeout(() => {
      const scripts = Array.from(
        document.head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
      );
      const parsed = scripts
        .map(s => { try { return JSON.parse(s.textContent || 'null'); } catch { return null; } })
        .filter(Boolean);

      const headItemList = parsed.find(p => p?.['@type'] === 'ItemList') as ItemList | undefined;
      const headWebPage = parsed.find(p => p?.['@type'] === 'WebPage') as WebPage | undefined;
      const headBreadcrumb = parsed.find(
        p => p?.['@type'] === 'BreadcrumbList' || p?.breadcrumb?.['@type'] === 'BreadcrumbList',
      );

      const problems: string[] = [];

      if (!headWebPage) problems.push('WebPage JSON-LD missing from <head>.');
      else if (headWebPage.url !== expected.webPage.url) {
        problems.push(`WebPage url mismatch: head=${headWebPage.url} vs expected=${expected.webPage.url}`);
      }

      if (!headBreadcrumb) problems.push('BreadcrumbList JSON-LD missing from <head>.');

      if (!headItemList) {
        problems.push('ItemList JSON-LD missing from <head>.');
      } else {
        const headItems = headItemList.itemListElement ?? [];
        const expectedItems = expected.itemList.itemListElement ?? [];
        if (headItems.length !== expectedItems.length) {
          problems.push(
            `ItemList length drift: head=${headItems.length} vs expected=${expectedItems.length}`,
          );
        }
        // Compare rendered DOM rows against the JSON-LD ItemList.
        const rendered = Array.from(document.querySelectorAll<HTMLElement>(rowSelector));
        const renderedNames = rendered
          .map(el => el.getAttribute(rowNameAttr) || '')
          .filter(Boolean);
        const headNames = headItems.map(it => it.name);
        const compareCount = Math.min(renderedNames.length, headNames.length);
        for (let i = 0; i < compareCount; i++) {
          if (renderedNames[i] !== headNames[i]) {
            problems.push(
              `Row #${i + 1} name mismatch: DOM="${renderedNames[i]}" vs JSON-LD="${headNames[i]}"`,
            );
            break;
          }
        }
        // Positions must be 1..N and contiguous.
        for (let i = 0; i < headItems.length; i++) {
          if (headItems[i].position !== i + 1) {
            problems.push(`ItemList position drift at index ${i}: got ${headItems[i].position}`);
            break;
          }
        }
      }

      if (problems.length > 0) {
        // eslint-disable-next-line no-console
        console.group('[jsonLdSyncCheck] JSON-LD ↔ DOM drift detected');
        // eslint-disable-next-line no-console
        problems.forEach(p => console.error(p));
        // eslint-disable-next-line no-console
        console.groupEnd();
      }
    }, 50);

    return () => window.clearTimeout(id);
  }, [enabled, expected, rowSelector, rowNameAttr]);
}
