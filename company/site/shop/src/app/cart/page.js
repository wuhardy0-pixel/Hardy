"use client";
import Link from "next/link";
import { useCart, cart, money } from "../../lib/cart";

export default function CartPage() {
  const items = useCart();
  const count = items.reduce((n, x) => n + x.qty, 0);
  const sub = cart.subtotalCents(items);
  if (items.length === 0) return (
    <main>
      <h1 className="page-title">Shopping cart</h1>
      <div className="empty"><h2>Your cart is empty</h2><p>Pick a design, choose your colors, and it will show up here.</p><p style={{ marginTop: 12 }}><Link href="/" className="btn-yellow">Browse products</Link></p></div>
    </main>);
  return (
    <main>
      <h1 className="page-title">Shopping cart</h1>
      <div className="cart">
        <section className="cart-list">
          {items.map((x) => (
            <div className="cart-line" key={x.id}>
              <Link href={`/products/${x.slug}`}><img src={x.photo} alt={x.name} /></Link>
              <div>
                <h3><Link href={`/products/${x.slug}`} style={{ color: "inherit" }}>{x.name}</Link></h3>
                <div className="instock" style={{ fontSize: 12 }}>In stock · made to order</div>
                <div className="opts">{x.summary}</div>
                <div className="act">
                  <label>Qty:&nbsp;
                    <select value={x.qty} onChange={(e) => cart.setQty(x.id, Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                  </label>
                  <button className="link" onClick={() => cart.remove(x.id)}>Delete</button>
                  <Link href={`/products/${x.slug}`}>Change options</Link>
                </div>
              </div>
              <div className="lp">{money(x.unitCents * x.qty)}<div style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-soft)" }}>{money(x.unitCents)} each</div></div>
            </div>
          ))}
          <div style={{ textAlign: "right", fontSize: 17, paddingTop: 12 }}>Subtotal ({count} item{count === 1 ? "" : "s"}): <b>{money(sub)}</b></div>
        </section>
        <aside className="side-box">
          <div className="sub">Subtotal ({count} item{count === 1 ? "" : "s"}): <b>{money(sub)}</b></div>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>+ $5.00 flat shipping at checkout</div>
          <Link href="/checkout" className="btn-yellow" style={{ padding: 10 }}>Proceed to checkout</Link>
          <Link href="/" style={{ fontSize: 13 }}>Keep shopping</Link>
        </aside>
      </div>
    </main>
  );
}
