"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart } from "../lib/cart";

export default function Header({ shopName, categories }) {
  const items = useCart();
  const count = items.reduce((n, x) => n + x.qty, 0);
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("k") || "");
  const [me, setMe] = useState(null);
  useEffect(() => { fetch("/api/me", { cache: "no-store" }).then((r) => r.json()).then(setMe).catch(() => setMe({})); }, []);
  const search = (e) => { e.preventDefault(); router.push(`/s?k=${encodeURIComponent(q.trim())}`); };
  const signIn = `https://log3d.hardywu.com/?next=${encodeURIComponent(typeof location !== "undefined" ? location.pathname : "/")}`;
  return (
    <header className="hd">
      <div className="hd-top">
        <Link href="/" className="logo"><span className="logo-name">{shopName}</span><span className="logo-sub">3D-printed, made to order</span></Link>
        <form className="search" onSubmit={search} role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Hardy's 3D" aria-label="Search" />
          <button type="submit" aria-label="Search">🔍</button>
        </form>
        <div className="hd-links">
          {me?.name ? (
            <Link href="/orders" className="hd-link"><small>Hello, {me.name.split(" ")[0]}</small><b>Account</b></Link>
          ) : (
            <a href={signIn} className="hd-link"><small>Hello, sign in</small><b>Account</b></a>
          )}
          <Link href="/orders" className="hd-link"><small>Returns</small><b>&amp; Orders</b></Link>
          <Link href="/cart" className="hd-cart" aria-label={`Cart, ${count} items`}>
            <span className="cart-ic">🛒<i>{count}</i></span><b>Cart</b>
          </Link>
        </div>
      </div>
      <nav className="hd-nav">
        <Link href="/s">☰ All</Link>
        {categories.map((c) => <Link key={c} href={`/s?c=${encodeURIComponent(c)}`}>{c}</Link>)}
        <Link href="/s?custom=1">Customizable</Link>
        <Link href="/orders">Your orders</Link>
        <Link href="/#about">About the shop</Link>
        <a href="https://hardywu.com/">← hardywu.com</a>
      </nav>
    </header>
  );
}
