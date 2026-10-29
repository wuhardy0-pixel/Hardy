import { NextResponse } from "next/server";
import { sendOrderEmails } from "../../../lib/orderEmail";
import { getProduct } from "../../../lib/catalog";

// Stripe calls this after a successful card payment. This — not the thank-you page —
// records the order on Hardy's server and sends the order email, so an order can never
// be missed because the customer closed the tab. Stripe retries on a 500, and each item
// carries a ref (session id + line) so a retry never records the same order twice.
export async function POST(request) {
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const payload = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  if (event.type !== "checkout.session.completed" || event.data.object.payment_status !== "paid") return NextResponse.json({ received: true });

  const s = event.data.object;
  const m = s.metadata || {};
  const items = [];
  for (let i = 0; i < Number(m.n || 0); i++) { try { items.push(JSON.parse(m[`item_${i}`])); } catch {} }
  const email = m.email || s.customer_details?.email || "";
  const paidStr = `$${(s.amount_total / 100).toFixed(2)} paid by card (Stripe)`;
  const pname = (it) => getProduct(it.s)?.name || it.s;
  const ids = [];
  let fresh = false;
  for (const [i, it] of items.entries()) {
    const ship = i === 0 ? Number(m.shipping || 0) : 0;
    const res = await fetch("http://127.0.0.1:5000/api/order/from-shop", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `${s.id}#${i}`, account: m.account, product: it.s, product_name: pname(it), qty: it.q, color: it.c, price_each: it.p / 100, total: (it.p * it.q + ship) / 100,
        buyer: m.name || s.customer_details?.name || "Online customer", email, phone: m.phone, ship_to: m.ship,
        details: `PAID by card · ${it.m}${it.u ? ` · ${it.u}` : ""}` }),
    }).catch(() => null);
    const d = res && res.ok ? await res.json() : null;
    if (!d?.order) return NextResponse.json({ error: "could not record the order" }, { status: 500 });   // Stripe retries
    ids.push(d.order);
    if (!d.duplicate) fresh = true;
  }
  if (!fresh) return NextResponse.json({ received: true, orders: ids });   // a retry of something already recorded and emailed
  try {
    await sendOrderEmails({ orderNumber: ids.join(", ") || s.id.slice(-8), date: new Date(s.created * 1000).toLocaleString("en-US"),
      productName: items.map((it) => `${pname(it)} × ${it.q}`).join(", "), qty: items.reduce((n, it) => n + it.q, 0),
      color: items.map((it) => it.m).join(" | "), colorRequest: items.map((it) => it.cr).filter(Boolean).join(" | ") || null, text: null,
      uploadUrl: items.find((it) => it.u)?.u || null, uploadName: items.find((it) => it.u)?.un || null,
      paid: paidStr, customerName: m.name, customerEmail: email, customerPhone: m.phone, shipTo: m.ship,
      note: "Paid on shop.hardywu.com. The money is in Stripe; print and ship." });
  } catch (e) { console.error("[order email failed — order is recorded]", ids, e.message); }
  return NextResponse.json({ received: true, orders: ids });
}
