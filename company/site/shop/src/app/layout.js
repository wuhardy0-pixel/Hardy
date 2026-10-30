import "./globals.css";
import { Suspense } from "react";
import { shop } from "../lib/catalog";
import Header from "../components/Header";

export const metadata = {
  title: "Hardy's 3D — custom 3D-printed pieces",
  description: "3D-printed pieces, made just for you. Pick a design, choose your colors, add a name or your own photo.",
};

// PREVIEW_SITE (only in a preview copy) points every link at the local hardywu.com instead of the real one.
const PREVIEW = process.env.PREVIEW_SITE || "";
const V = Date.now().toString(36);   // a new version each time the store starts, so browsers fetch fresh style files
export const SITE = PREVIEW || "https://hardywu.com";
export const SIGNIN = PREVIEW ? PREVIEW + "/go/3d" : "https://log3d.hardywu.com/";   // "?next=…" is added to this

// The one clay style shared with hardywu.com (company/site/style/, copied to public/style/).
// theme.js sets Cozy / Space before the page paints; the switch itself is drawn by <Header>.
export default function RootLayout({ children }) {
  return (
    <html lang="en" data-switch="react" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={`/style/clay.css?v=${V}`} />
        <script src={`/style/theme.js?v=${V}`} />
        <link rel="icon" href={SITE + "/favicon.png"} />
        <link rel="alternate" type="application/json" title="Product catalogue for AI agents" href="https://hardywu.com/products.json" />
        <link rel="help" href="https://hardywu.com/llms.txt" />
        <meta name="ai-agents" content="catalogue, cart and checkout for AI assistants: https://hardywu.com/llms.txt" />
      </head>
      <body>
        <div className="blobs" aria-hidden="true"><span className="blob b1" /><span className="blob b2" /><span className="blob b3" /><span className="blob b4" /></div>
        <Suspense fallback={<div className="site-head clay" style={{ height: 72 }} />}>
          <Header shopName={shop.shopName} categories={shop.categories || []} site={SITE} signInBase={SIGNIN} absoluteNext={!!PREVIEW} />
        </Suspense>
        <div className="wrap page">{children}</div>
        <footer className="shop-foot">
          <span>© {new Date().getFullYear()} {shop.shopName} · every piece printed to order by Hardy Wu</span>
          <span>{process.env.CARD_PAYMENTS ? "FREE shipping (US) · secure card payment by Stripe" : "FREE shipping (US) · no card needed now: Hardy emails you to arrange payment"}</span>
        </footer>
      </body>
    </html>
  );
}
