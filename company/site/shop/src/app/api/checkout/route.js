import { NextResponse } from "next/server";
import { shop, getProduct } from "../../../lib/catalog";
import { sendOrderEmails } from "../../../lib/orderEmail";

const AD = shop.addons || { text: 2, image: 2, extraColor: 2 };   // dollars, from the catalog
export const dynamic = "force-dynamic";

// Check one cart line against the catalog and price it on the server (never trust the browser's price).
function priceLine(body) {
  const product = getProduct(body.slug);
  if (!product) return { error: "unknown product" };
  if (product.in_stock === false) return { error: `${product.name} is sold out right now` };
  const qty = Math.min(9, Math.max(1, Number(body.qty) || 1));
  const text = product.text && body.text ? String(body.text).slice(0, 30) : null;
  const uploadUrl = product.image ? body.uploadUrl || null : null;
  const colorRequest = body.colorRequest ? String(body.colorRequest).slice(0, 200) : null;
  if (product.image?.required && !uploadUrl) return { error: `${product.name} needs an uploaded image` };
  const zones = product.zones || ["Color"];
  const textZone = product.preview?.canvasTextZone;
  const activeZones = zones.filter((z) => z !== textZone || text);
  const colors = { ...(body.colors || {}) };
  if (!shop.colors.some((c) => c.name === colors[activeZones[0]])) return { error: `please pick a color for ${product.name}` };
  for (const z of activeZones) { if (!colors[z]) colors[z] = colors[activeZones[0]]; if (!shop.colors.some((c) => c.name === colors[z])) return { error: `unknown color for ${z}` }; }
  const distinct = new Set(activeZones.map((z) => colors[z])).size;
  const placement = body.placement && typeof body.placement === "object" ? JSON.stringify(body.placement).slice(0, 200) : null;
  const unitCents = Math.round((product.price + (text ? AD.text : 0) + (uploadUrl ? AD.image : 0) + Math.max(0, distinct - 1) * AD.extraColor) * 100);
  const colorStr = activeZones.length > 1 ? activeZones.map((z) => `${z}: ${colors[z]}`).join(" · ") : colors[activeZones[0]];
  const summary = [`Color: ${colorStr}`, colorRequest && `Color request: "${colorRequest}"`, text && `Text: "${text}"`, uploadUrl && `Image: ${body.uploadName || "uploaded"}`, placement && `Placement: ${placement}`].filter(Boolean).join(" · ");
  return { product, qty, text, uploadUrl, uploadName: body.uploadName || null, colorRequest, colorStr, unitCents, summary };
}

export async function POST(request) {
  const body = await request.json();
  const rawItems = Array.isArray(body.items) ? body.items : [body];   // the old single-product form still works
  if (!rawItems.length) return NextResponse.json({ error: "your cart is empty" }, { status: 400 });
  const host = request.headers.get("host") || "";
  const signedIn = /(?:^|;\s*)session=/.test(request.headers.get("cookie") || "");
  if (host === "shop.hardywu.com" && !signedIn) return NextResponse.json({ error: "please sign in to order", login: `https://log3d.hardywu.com/?next=${encodeURIComponent("/checkout")}` }, { status: 401 });
  const lines = [];
  for (const raw of rawItems) { const l = priceLine(raw); if (l.error) return NextResponse.json({ error: l.error }, { status: 400 }); lines.push(l); }
  const name = String(body.name || "").trim().slice(0, 60);
  const email = String(body.email || "").trim().slice(0, 90);
  const phone = String(body.phone || "").trim().slice(0, 40);
  const shipTo = [name, body.line1, body.line2, [body.city, body.state, body.zip].filter(Boolean).join(" ")].map((x) => String(x || "").trim()).filter(Boolean).join("\n").slice(0, 300);
  const origin = request.headers.get("origin") || new URL(request.url).origin;
  const itemsCents = lines.reduce((n, l) => n + l.unitCents * l.qty, 0);
  const totalCents = itemsCents + shop.shippingCents;

  // No card online yet (no Stripe key): record each item as an order on Hardy's server, email, and confirm.
  if (!process.env.STRIPE_SECRET_KEY) {
    const ids = [];
    for (const [i, l] of lines.entries()) {
      const ship = i === 0 ? shop.shippingCents : 0;   // shipping is charged once, on the first item
      try {
        const res = await fetch("http://127.0.0.1:5000/api/order/from-shop", {
          method: "POST", headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") || "" },
          body: JSON.stringify({ product: l.product.slug, product_name: l.product.name, qty: l.qty, color: l.colorStr, price_each: l.unitCents / 100, total: (l.unitCents * l.qty + ship) / 100,
            buyer: name || "Online customer", email, phone, ship_to: shipTo, details: `${l.summary}${ship ? ` · incl. $${(ship / 100).toFixed(2)} shipping` : ""}${l.uploadUrl ? ` · ${new URL(l.uploadUrl, origin).href}` : ""}` }),
        });
        const d = await res.json(); if (d.order) ids.push(d.order);
      } catch {}
    }
    const orderNumber = ids.join(", ") || `WEB-${Date.now().toString().slice(-6)}`;
    await sendOrderEmails({ orderNumber, date: new Date().toLocaleString("en-US"), productName: lines.map((l) => `${l.product.name} × ${l.qty}`).join(", "), qty: lines.reduce((n, l) => n + l.qty, 0),
      color: lines.map((l) => l.summary).join(" | "), colorRequest: lines.map((l) => l.colorRequest).filter(Boolean).join(" | ") || null, text: null,
      uploadUrl: lines.find((l) => l.uploadUrl)?.uploadUrl ? new URL(lines.find((l) => l.uploadUrl).uploadUrl, origin).href : null, uploadName: lines.find((l) => l.uploadUrl)?.uploadName,
      paid: `$${(totalCents / 100).toFixed(2)} to arrange by email (no card taken online)`, customerName: name, customerEmail: email, customerPhone: phone, shipTo, note: "Placed on shop.hardywu.com. Email the customer to confirm colors and payment." });
    return NextResponse.json({ ok: true, orders: ids, url: `${origin}/thank-you?orders=${encodeURIComponent(ids.join(","))}&demo=1` });
  }

  // Card payment: send the buyer to Stripe. The order is recorded and emailed by /api/webhook once Stripe says it is paid.
  let account = "";
  try { const r = await fetch("http://127.0.0.1:5000/api/me", { headers: { cookie: request.headers.get("cookie") || "" }, cache: "no-store" }); account = (await r.json()).email || ""; } catch {}
  const metadata = { name, email, phone, ship: shipTo.slice(0, 500), account, shipping: String(shop.shippingCents), n: String(lines.length) };
  lines.forEach((l, i) => {   // Stripe allows 500 characters per metadata value, so one value per cart line
    const item = { s: l.product.slug, q: l.qty, p: l.unitCents, c: l.colorStr.slice(0, 120), u: l.uploadUrl ? new URL(l.uploadUrl, origin).href : null, un: l.uploadName, cr: l.colorRequest };
    item.m = l.summary.slice(0, Math.max(0, 480 - JSON.stringify(item).length));
    metadata[`item_${i}`] = JSON.stringify(item);
  });
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const lineItems = lines.map((l) => ({ quantity: l.qty, price_data: { currency: shop.currency, unit_amount: l.unitCents, product_data: { name: l.product.name, description: l.summary.slice(0, 500), images: [new URL(l.product.photos[0], origin).href] } } }));
  if (shop.shippingCents) lineItems.push({ quantity: 1, price_data: { currency: shop.currency, unit_amount: shop.shippingCents, product_data: { name: "Shipping (US)" } } });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: email || undefined,   // the address was already typed on our checkout page
      metadata,
      payment_intent_data: { metadata: { name, email } },
      success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?cancelled=1`,
    });
    return NextResponse.json({ url: session.url, card: true });
  } catch (e) {
    console.error("[stripe checkout]", e.message);
    return NextResponse.json({ error: "Card payment is not available right now. Please try again in a few minutes." }, { status: 502 });
  }
}
