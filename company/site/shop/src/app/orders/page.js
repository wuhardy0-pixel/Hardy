"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const LABEL = { ordered: "Ordered — Hardy will email you about payment, then print it", printed: "Printed — getting packed", shipped: "Shipped", returned: "Returned", cancelled: "Cancelled" };

export default function Orders() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(0);
  useEffect(() => { fetch("/api/my-orders", { cache: "no-store" }).then(async (r) => { setStatus(r.status); setData(await r.json()); }).catch(() => { setStatus(502); setData({}); }); }, []);
  const signIn = `https://log3d.hardywu.com/?next=${encodeURIComponent("/orders")}`;
  if (!data) return <main><h1 className="page-title">Your orders</h1><p>Loading…</p></main>;
  if (status === 401) return (<main><h1 className="page-title">Your orders</h1><div className="signin-box"><span>Sign in to see your orders.</span><a href={signIn} className="btn-yellow">Sign in</a></div></main>);
  if (status >= 500) return (<main><h1 className="page-title">Your orders</h1><div className="empty"><h2>The order list isn't available right now</h2><p>Please try again in a minute.</p></div></main>);
  const orders = data.orders || [];
  return (
    <main>
      <h1 className="page-title">Your orders</h1>
      <p style={{ marginBottom: 12, color: "var(--ink-soft)" }}>{data.name ? `${data.name} · ` : ""}{data.email}</p>
      {orders.length === 0 && <div className="empty"><h2>No orders yet</h2><p><Link href="/" className="btn-yellow">Start shopping</Link></p></div>}
      {orders.map((o) => {
        const st = (o.status || "ordered").toLowerCase(); const date = new Date(o.created_at);
        return (
          <article className="order" key={o.id}>
            <div className="order-head">
              <span>Order placed<b>{date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</b></span>
              <span>Total<b>${Number(o.total).toFixed(2)}</b></span>
              {o.ship_to && <span>Ship to<b>{o.ship_to.split("\n")[0]}</b></span>}
              <span style={{ marginLeft: "auto" }}>Order #<b className="mono">{o.id}</b></span>
            </div>
            <div className="order-body">
              <div>
                <div className={`status ${st}`}>{LABEL[st] || o.status}{o.print_status === "done" && st === "ordered" ? " · printed" : ""}</div>
                <h3>{o.product_name || o.product} × {o.qty}</h3>
                <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{o.color}{o.custom_text ? ` · ${o.custom_text}` : ""}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Link href={`/products/${o.product}`} className="btn-yellow">Buy it again</Link>
                <a href={`mailto:wuhardy0@gmail.com?subject=Order ${o.id}`} className="opt" style={{ textAlign: "center" }}>Ask Hardy about it</a>
              </div>
            </div>
          </article>);
      })}
    </main>
  );
}
