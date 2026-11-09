import { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";

const BASE = "https://investmentsimulator.app/";
const tag = (source: string, medium: string) =>
  `${BASE}?utm_source=${source}&utm_medium=${medium}&utm_campaign=class_share_kit`;

const LINKS = [
  { label: "Google Classroom link", url: tag("google_classroom", "classroom") },
  { label: "Microsoft Teams link", url: tag("microsoft_teams", "classroom") },
  { label: "QR code / projector link", url: tag("qr", "print") },
];

const MESSAGE = `Today we're playing Rise to Riches, a free stock market simulator. Open this link, enter your first name, and invest through real market history. No account needed:\n${tag("google_classroom", "classroom")}`;

export const ClassShareKit = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch { /* clipboard blocked */ }
  };
  const Btn = ({ k, text }: { k: string; text: string }) => (
    <button
      type="button"
      onClick={() => copy(k, text)}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-3 py-1.5 text-xs hover:bg-muted"
      aria-label={`Copy ${k}`}
    >
      {copied === k ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      {copied === k ? "Copied" : "Copy"}
    </button>
  );

  return (
    <section id="share-kit" className="mb-12 space-y-4 rounded-xl border border-primary/30 bg-card/40 p-6">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <Share2 className="h-6 w-6 text-primary" /> Class sharing kit
      </h2>
      <p className="text-muted-foreground">
        Post one of these links where your students already are. Each one is labeled so we can see
        which classroom tools bring students in.
      </p>
      <div className="flex flex-wrap gap-3">
        <a
          href={`https://classroom.google.com/share?url=${encodeURIComponent(LINKS[0].url)}`}
          target="_blank" rel="noopener noreferrer"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >Share to Google Classroom</a>
        <a
          href={`https://teams.microsoft.com/share?href=${encodeURIComponent(LINKS[1].url)}&msgText=${encodeURIComponent("Free stock market simulator for class")}`}
          target="_blank" rel="noopener noreferrer"
          className="rounded-md border border-border/60 px-4 py-2 text-sm font-medium hover:bg-muted"
        >Share to Microsoft Teams</a>
      </div>
      <ul className="space-y-3">
        {LINKS.map((l) => (
          <li key={l.label} className="flex items-center justify-between gap-3 rounded-md bg-background/60 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{l.label}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{l.url}</p>
            </div>
            <Btn k={l.label} text={l.url} />
          </li>
        ))}
      </ul>
      <div className="rounded-md bg-background/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Ready-to-post message for students</p>
          <Btn k="message" text={MESSAGE} />
        </div>
        <p className="whitespace-pre-line text-sm text-muted-foreground">{MESSAGE}</p>
      </div>
    </section>
  );
};
