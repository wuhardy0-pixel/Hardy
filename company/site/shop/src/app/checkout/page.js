"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart, cart, money } from "../../lib/cart";

const SHIPPING = 0;
const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

export default function Checkout() {
  const items = useCart();
  const [me, setMe] = useState(null);
  const [f, setF] = useState({ name: "", email: "", line1: "", line2: "", city: "", state: "MD", zip: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const onShop = typeof location !== "undefined" && location.hostname === "shop.hardywu.com";
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" }).then((r) => r.json()).then((m) => { setMe(m); setF((x) => ({ ...x, name: m.name || x.name, email: m.email || x.email })); }).catch(() => setMe({}));
    try { const saved = JSON.parse(localStorage.getItem("hardys3d-address") || "null"); if (saved) setF((x) => ({ ...x, ...saved, name: x.name || saved.name, email: x.email || saved.email })); } catch {}
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const sub = cart.subtotalCents(items);
  const signedIn = !!me?.email;
  const needSignIn = onShop && me && !signedIn;
  const signIn = `https://log3d.hardywu.com/?next=${encodeURIComponent("/checkout")}`;

  const place = async () => {
    setError("");
    for (const [k, label] of [["name", "your name"], ["email", "your email"], ["line1", "your street address"], ["city", "your city"], ["zip", "your ZIP code"]]) if (!f[k].trim()) { setError(`Please enter ${label}.`); return; }
    if (!/^\S+@\S+\.\S+$/.test(f.email)) { setError("That email doesn't look right."); return; }
    setBusy(true);
    try { localStorage.setItem("hardys3d-address", JSON.stringify(f)); } catch {}
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, ...f }) });
      const d = await res.json();
      if (res.status === 401 && d.login) { location.href = d.login; return; }
      if (!res.ok) throw new Error(d.error || "Something went wrong placing the order.");
      cart.clear(); location.href = d.url;
    } catch (e) { setError(e.message); setBusy(false); }
  };

  if (items.length === 0) return (<main><h1 className="page-title">Checkout</h1><div className="empty"><h2>Nothing to check out yet</h2><p><Link href="/" className="btn-yellow">Browse products</Link></p></div></main>);
  return (
    <main>
      <h1 className="page-title">Checkout ({items.reduce((n, x) => n + x.qty, 0)} items)</h1>
      <div className="co">
        <div>
          <section className="co-step">
            <h2><span className="n">1</span> Who is this for?</h2>
            {needSignIn ? (
              <div className="signin-box"><span>Sign in with your name and email so Hardy knows who the order is for.</span><a href={signIn} className="btn-yellow">Sign in to continue</a></div>
            ) : signedIn ? (
              <p>Signed in as <b>{me.name}</b> ({me.email}). Not you? <a href="https://log3d.hardywu.com/signout">Sign out</a></p>
            ) : (
              <div className="form"><label>Full name<input className="textbox" value={f.name} onChange={set("name")} /></label><label>Email<input className="textbox" type="email" value={f.email} onChange={set("email")} /></label></div>
            )}
          </section>
          <section className="co-step">
            <h2><span className="n">2</span> Shipping address</h2>
            <div className="form">
              <label className="full">Full name<input className="textbox" value={f.name} onChange={set("name")} autoComplete="name" /></label>
              <label className="full">Street address<input className="textbox" value={f.line1} onChange={set("line1")} autoComplete="address-line1" /></label>
              <label className="full">Apt, suite, unit (optional)<input className="textbox" value={f.line2} onChange={set("line2")} autoComplete="address-line2" /></label>
              <label>City<input className="textbox" value={f.city} onChange={set("city")} autoComplete="address-level2" /></label>
              <label>State<select className="textbox" value={f.state} onChange={set("state")}>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label>ZIP code<input className="textbox" value={f.zip} onChange={set("zip")} autoComplete="postal-code" inputMode="numeric" /></label>
              <label>Phone (for the carrier)<input className="textbox" value={f.phone} onChange={set("phone")} autoComplete="tel" inputMode="tel" /></label>
            </div>
          </section>
          <section className="co-step">
            <h2><span className="n">3</span> Payment</h2>
            <div className="pay-note">No card is needed now. Hardy emails you after the order to arrange payment (and answers any questions about your colors) before printing starts.</div>
          </section>
          <section className="co-step">
            <h2><span className="n">4</span> Review items</h2>
            {items.map((x) => <div className="co-item" key={x.id}><img src={x.photo} alt="" /><div><b>{x.name} × {x.qty}</b><span style={{ color: "var(--ink-soft)" }}>{x.summary}</span></div><div style={{ marginLeft: "auto", fontWeight: 700 }}>{money(x.unitCents * x.qty)}</div></div>)}
            <p style={{ marginTop: 8, fontSize: 13 }}><Link href="/cart">Change quantities or options</Link></p>
          </section>
        </div>
        <aside className="side-box">
          <button className="btn-yellow" style={{ padding: 10 }} onClick={place} disabled={busy || needSignIn}>{busy ? "Placing your order…" : "Place your order"}</button>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>By placing this order you agree Hardy may email you about it.</div>
          <div className="sline" style={{ display: "flex", justifyContent: "space-between" }}><span>Items:</span><span>{money(sub)}</span></div>
          <div className="sline" style={{ display: "flex", justifyContent: "space-between" }}><span>Shipping:</span><span style={{ color: "var(--ok)", fontWeight: 700 }}>FREE</span></div>
          <div className="sline" style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, color: "var(--price)" }}><span>Order total:</span><span>{money(sub + SHIPPING)}</span></div>
          {error && <div className="error" role="alert">{error}</div>}
        </aside>
      </div>
    </main>
  );
}
