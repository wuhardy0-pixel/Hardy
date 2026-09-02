import "./globals.css";
import Link from "next/link";
import { shop } from "../lib/catalog";

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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet" />
        <link rel="icon" href="https://hardywu.com/favicon.png" />
      </head>
      <body>
        <div className="wrap">
          <header className="site-head">
            <Link href="/" className="brand">Hardy&rsquo;s <span>3D</span></Link>
            <nav className="nav">
              <Link href="/#products">Products</Link>
              <Link href="/#about">About</Link>
            </nav>
          </header>
          {children}
          <footer className="site-foot">
            <span>© {new Date().getFullYear()} {shop.shopName}</span>
            <span>Every piece printed to order · Flat $5 shipping (US)</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
