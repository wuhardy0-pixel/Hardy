import "./globals.css";
import { Suspense } from "react";
import { shop } from "../lib/catalog";
import Header from "../components/Header";

export const metadata = {
  title: "Hardy's 3D — custom 3D-printed pieces",
  description: "3D-printed pieces, made just for you. Pick a design, choose your colors, add a name or your own photo.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet" />
        <link rel="icon" href="https://hardywu.com/favicon.png" />
        <link rel="alternate" type="application/json" title="Product catalogue for AI agents" href="https://hardywu.com/products.json" />
        <link rel="help" href="https://hardywu.com/llms.txt" />
        <meta name="ai-agents" content="catalogue, cart and checkout for AI assistants: https://hardywu.com/llms.txt" />
      </head>
      <body>
        <Suspense fallback={<div className="hd" style={{ height: 94 }} />}>
          <Header shopName={shop.shopName} categories={shop.categories || []} />
        </Suspense>
        <div className="wrap">{children}</div>
        <a href="#" className="totop">Back to top</a>
        <footer className="site-foot"><div className="wrap">
          <span>© {new Date().getFullYear()} {shop.shopName} · every piece printed to order by Hardy Wu</span>
          <span>FREE shipping (US) · no card needed now: Hardy emails you to arrange payment</span>
          <span>🤖 AI assistants: catalogue and checkout at <a href="https://hardywu.com/llms.txt">hardywu.com/llms.txt</a></span>
        </div></footer>
      </body>
    </html>
  );
}
