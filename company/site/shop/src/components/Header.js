"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCart } from "../lib/cart";

// The same clay header as hardywu.com: Shop · Make your own · Games, the Cozy / Space switch,
// plus the store's own search, account and cart, and a row of category chips.
function ThemeSwitch() {
  const [t, setT] = useState("cozy");
  useEffect(() => { setT(document.documentElement.dataset.theme || "cozy"); }, []);
  const pick = (v) => {
    const root = document.documentElement;
    root.classList.add("theme-anim"); root.dataset.theme = v; setT(v);
    const dom = location.hostname.endsWith("hardywu.com") ? ";domain=.hardywu.com" : "";
    document.cookie = `hw_theme=${v};path=/;max-age=31536000;SameSite=Lax${dom}`;   // shared with hardywu.com
    try { localStorage.setItem("hw-theme", v); } catch {}
    setTimeout(() => root.classList.remove("theme-anim"), 600);
  };
  return (
    <div className="theme-switch" role="group" aria-label="Page style">
      <button aria-pressed={t === "cozy"} onClick={() => pick("cozy")} title="Cozy style">
        <svg viewBox="0 0 24 24"><path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z" /></svg><span>Cozy</span>
      </button>
      <button aria-pressed={t === "space"} onClick={() => pick("space")} title="Space style">
        <svg viewBox="0 0 24 24"><path d="M12 2c3 2 5 6 5 10l-2 5H9l-2-5c0-4 2-8 5-10z" /><circle cx="12" cy="10" r="2" /><path d="M9 17l-2 4M15 17l2 4" /></svg><span>Space</span>
      </button>
    </div>
  );
}

const I = {
  orders: <svg className="ic" viewBox="0 0 24 24"><path d="M3 4h2l2.4 11h11l2-8H6.2" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></svg>,
  apps: <svg className="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>,
  list: <svg className="ic" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" /></svg>,
  eye: <svg className="ic" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  chat: <svg className="ic" viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z" /></svg>,
  office: <svg className="ic" viewBox="0 0 24 24"><path d="M4 21V5l8-3 8 3v16M9 9h2M13 9h2M9 13h2M13 13h2M10 21v-4h4v4" /></svg>,
  out: <svg className="ic" viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3M13 4h6v16h-6" /></svg>,
};
function AccountMenu({ me, site, signIn }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, []);
  if (me === null) return <div className="acct" />;                      // still asking who is signed in
  if (!me.name) return <a className="chip dark press" href={signIn}>Sign in</a>;
  const words = me.name.trim().split(/\s+/), ini = words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="acct" ref={box}>
      <button className="avatar" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <i>{ini}</i><span>{words[0]}</span><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className={`menu${open ? " open" : ""}`} role="menu">
        <div className="who"><b>{me.name}</b><span>{me.email}</span></div>
        <Link href="/orders">{I.orders}Your orders</Link>
        {me.family && <a href={site + "/apps"}>{I.apps}Apps</a>}
        {me.hardy && <><div className="grp">Hardy’s pages</div><a href={site + "/orders"}>{I.list}Orders</a><a href={site + "/activity"}>{I.eye}Who visited</a><a href={site + "/feedback"}>{I.chat}Feedback</a></>}
        {me.staff && <a href="https://office.hardywu.com/">{I.office}Office</a>}
        <a className="out" href={site + "/signout"}>{I.out}Sign out</a>
      </div>
    </div>
  );
}

export default function Header({ shopName, categories, site, signInBase, absoluteNext }) {
  const items = useCart();
  const count = items.reduce((n, x) => n + x.qty, 0);
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("k") || "");
  const [me, setMe] = useState(null);
  useEffect(() => { fetch("/api/me", { cache: "no-store" }).then((r) => r.json()).then(setMe).catch(() => setMe({})); }, []);
  const search = (e) => { e.preventDefault(); router.push(`/s?k=${encodeURIComponent(q.trim())}`); };
  const here = typeof location !== "undefined" ? (absoluteNext ? location.origin + location.pathname : location.pathname) : "/";
  const signIn = `${signInBase}?next=${encodeURIComponent(here)}`;
  const making = path === "/make";
  const cat = params.get("c");
  return (
    <header className="shop-head">
      <div className="site-head clay">
        <a className="brand" href={site + "/"}><img src={site + "/logo.png"} alt="" />{shopName}</a>
        <nav>
          <ThemeSwitch />
          <Link className={`chip press${making ? "" : " on"}`} href="/">Shop</Link>
          <a className={`chip press${making ? " on" : ""}`} href="/make">Make your own</a>{/* a full page load starts the playground */}
          <a className="chip press" href={site + "/games"}>Games</a>
          <a className="chip press" href={site + "/apps"}>AI Apps</a>
          <AccountMenu me={me} site={site} signIn={signIn} />
          <Link className="chip dark press" href="/cart" aria-label={`Cart, ${count} items`}>
            <svg className="i" viewBox="0 0 24 24"><path d="M3 4h2l2.4 11h11l2-8H6.2" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></svg>{count}
          </Link>
        </nav>
      </div>
      {!making && <div className="subnav">{/* the playground has no shop search or categories (Barbara, 2026-10-30) */}
        <form className="search clay" onSubmit={search} role="search">
          <svg className="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lunchboxes, fidgets, tools…" aria-label="Search" />
        </form>
        <div className="cats">
          <Link className={`pill${path === "/s" && !cat && !params.get("custom") && !params.get("k") ? " on" : ""}`} href="/s">All</Link>
          {categories.map((c) => <Link key={c} className={`pill${cat === c ? " on" : ""}`} href={`/s?c=${encodeURIComponent(c)}`}>{c}</Link>)}
        </div>
      </div>}
    </header>
  );
}
