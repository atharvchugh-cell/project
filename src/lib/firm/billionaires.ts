// The real world's ten richest people (approximate, rounded estimates for the game) and the
// rule for when the player joins the list. Presentation only: nothing here moves money.
import { withBase } from '@/lib/basePath';

export interface Billionaire { id: string; name: string; worth: number; source: string; photo: string; started: number; origin: string }
export const LIST_ENTRY = 150e9;
export const BILLIONAIRES: Billionaire[] = [
  { id: 'musk', name: 'Elon Musk', worth: 1.1e12, source: 'Tesla, SpaceX', photo: withBase('/billionaires/musk.jpg'), started: 1995, origin: 'Co-founded Zip2, a web software startup, in Palo Alto.' },
  { id: 'ellison', name: 'Larry Ellison', worth: 300e9, source: 'Oracle', photo: withBase('/billionaires/ellison.png'), started: 1977, origin: 'Co-founded Software Development Laboratories, later Oracle.' },
  { id: 'page', name: 'Larry Page', worth: 270e9, source: 'Google', photo: withBase('/billionaires/page.jpg'), started: 1998, origin: 'Started Google with Sergey Brin from a Stanford research project.' },
  { id: 'bezos', name: 'Jeff Bezos', worth: 250e9, source: 'Amazon', photo: withBase('/billionaires/bezos.jpg'), started: 1994, origin: 'Left a hedge fund job and started Amazon as an online bookstore in his garage.' },
  { id: 'brin', name: 'Sergey Brin', worth: 248e9, source: 'Google', photo: withBase('/billionaires/brin.jpg'), started: 1998, origin: 'Started Google with Larry Page from a Stanford research project.' },
  { id: 'zuckerberg', name: 'Mark Zuckerberg', worth: 230e9, source: 'Meta', photo: withBase('/billionaires/zuckerberg.jpg'), started: 2004, origin: 'Launched Facebook from his Harvard dorm room.' },
  { id: 'huang', name: 'Jensen Huang', worth: 170e9, source: 'Nvidia', photo: withBase('/billionaires/huang.jpg'), started: 1993, origin: "Co-founded Nvidia after meeting partners at a Denny's in San Jose." },
  { id: 'ballmer', name: 'Steve Ballmer', worth: 160e9, source: 'Microsoft', photo: withBase('/billionaires/ballmer.jpg'), started: 1980, origin: 'Joined Microsoft as employee number 30 and its first business manager.' },
  { id: 'arnault', name: 'Bernard Arnault', worth: 155e9, source: 'LVMH', photo: withBase('/billionaires/arnault.jpg'), started: 1984, origin: 'Took over a bankrupt textile group that owned Christian Dior.' },
  { id: 'buffett', name: 'Warren Buffett', worth: 150e9, source: 'Berkshire Hathaway', photo: withBase('/billionaires/buffett.jpg'), started: 1956, origin: 'Started an investment partnership in Omaha with money from family and friends.' },
  { id: 'gates', name: 'Bill Gates', worth: 120e9, source: 'Microsoft', photo: withBase('/billionaires/gates.jpg'), started: 1975, origin: 'Dropped out of Harvard to start Microsoft with Paul Allen.' },
  { id: 'dell', name: 'Michael Dell', worth: 145e9, source: 'Dell Technologies', photo: withBase('/billionaires/dell.jpg'), started: 1984, origin: 'Sold computers he built in his University of Texas dorm room.' },
  { id: 'ambani', name: 'Mukesh Ambani', worth: 110e9, source: 'Reliance Industries', photo: withBase('/billionaires/ambani.jpg'), started: 1981, origin: 'Joined his father\'s textile and yarn trading business.' },
  { id: 'ortega', name: 'Amancio Ortega', worth: 125e9, source: 'Inditex (Zara)', photo: withBase('/billionaires/ortega.jpg'), started: 1975, origin: 'Opened the first Zara store in A Coruna after years as a shop assistant.' },
  { id: 'jwalton', name: 'Jim Walton', worth: 115e9, source: 'Walmart', photo: withBase('/billionaires/jwalton.jpg'), started: 1962, origin: 'Heir to Walmart, which his father opened as one store in Arkansas.' },
  { id: 'bloomberg', name: 'Michael Bloomberg', worth: 105e9, source: 'Bloomberg LP', photo: withBase('/billionaires/bloomberg.jpg'), started: 1981, origin: 'Used his $10M severance from Salomon Brothers to build a data terminal.' },
  { id: 'slim', name: 'Carlos Slim', worth: 100e9, source: 'America Movil', photo: withBase('/billionaires/slim.jpg'), started: 1965, origin: 'Began buying companies in Mexico in his twenties, starting with a bottler.' },
  { id: 'adani', name: 'Gautam Adani', worth: 80e9, source: 'Adani Group', photo: withBase('/billionaires/adani.jpg'), started: 1988, origin: 'Dropped out of college and started a commodities trading firm.' },
  { id: 'griffin', name: 'Ken Griffin', worth: 45e9, source: 'Citadel', photo: withBase('/billionaires/griffin.jpg'), started: 1990, origin: 'Traded convertible bonds from his Harvard dorm, then founded the hedge fund Citadel.' },
];
export interface ListRow { rank: number; id: string; name: string; worth: number; source: string; photo?: string; started?: number; origin?: string; you?: boolean }
/** Top ten; the player appears only with a net worth above the entry bar, ranked by worth. */
export function richList(playerName: string, playerWorth: number, firmName: string) {
  const rows: Omit<ListRow, 'rank'>[] = [...BILLIONAIRES];
  const onList = playerWorth > LIST_ENTRY;
  if (onList) rows.push({ id: 'you', name: playerName, worth: playerWorth, source: firmName, you: true });
  rows.sort((a, b) => b.worth - a.worth);
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const you = ranked.find(r => r.you);
  return { rows: ranked.slice(0, 10), all: ranked, you, onList, toGo: Math.max(0, LIST_ENTRY - playerWorth) };
}
