import { NextResponse } from "next/server";
import { shop, getProduct } from "../../../lib/catalog";
import { sendOrderEmails } from "../../../lib/orderEmail";

const ADDON_CENTS = 200; // $2 per: picture, text, each extra color

export async function POST(request) {
  const body = await request.json();
  const product = getProduct(body.slug);
  if (!product) return NextResponse.json({ error: "unknown product" }, { status: 400 });

  const qty = Math.min(9, Math.max(1, Number(body.qty) || 1));
  const text = product.text && body.text ? String(body.text).slice(0, 30) : null;
  const uploadUrl = product.image ? body.uploadUrl || null : null;
  const colorRequest = body.colorRequest ? String(body.colorRequest).slice(0, 200) : null;
  if (product.image?.required && !uploadUrl) {
    return NextResponse.json({ error: "this product needs an uploaded image" }, { status: 400 });
  }

  // zones: first required, rest default to it; text-color zone only counts when text exists
  const zones = product.zones || ["Color"];
  const textZone = product.preview?.canvasTextZone;
  const activeZones = zones.filter((z) => z !== textZone || text);
  const colors = { ...(body.colors || {}) };
  if (!shop.colors.some((c) => c.name === colors[activeZones[0]])) {
    return NextResponse.json({ error: "please pick a color" }, { status: 400 });
  }
  for (const z of activeZones) {
    if (!colors[z]) colors[z] = colors[activeZones[0]];
    if (!shop.colors.some((c) => c.name === colors[z])) {
      return NextResponse.json({ error: `unknown color for ${z}` }, { status: 400 });
    }
  }

  // pricing: base + $2 text + $2 picture + $2 per extra distinct color
  const distinct = new Set(activeZones.map((z) => colors[z])).size;
  const addonsCents =
    (text ? ADDON_CENTS : 0) +
    (uploadUrl ? ADDON_CENTS : 0) +
    Math.max(0, distinct - 1) * ADDON_CENTS;
  const unitCents = product.price * 100 + addonsCents;
  const totalCents = unitCents * qty + shop.shippingCents;

  const colorStr = activeZones.length > 1
    ? activeZones.map((z) => `${z}: ${colors[z]}`).join(" · ")
    : colors[activeZones[0]];

  const optionSummary = [
    `Color: ${colorStr}`,
    colorRequest && `Color request: "${colorRequest}"`,
    text && `Text: "${text}"`,
    uploadUrl && `Image: ${body.uploadName || "uploaded"}`,
  ].filter(Boolean).join(" · ");

  const origin = request.headers.get("origin") || new URL(request.url).origin;

  // Demo mode: no Stripe key yet — record the order and skip payment.
  if (!process.env.STRIPE_SECRET_KEY) {
    const orderNumber = `DEMO-${Date.now().toString().slice(-6)}`;
    // Forward the order into BookKeep (runs on this same machine) so it shows
    // up on the owner's dashboard and can be booked as an invoice.
    try {
      await fetch("http://127.0.0.1:5000/api/order/from-shop", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: product.slug, product_name: product.name, qty,
          price_each: unitCents / 100, total: totalCents / 100,
          buyer: "Online customer", details: `${orderNumber} · ${optionSummary}`,
        }),
      });
    } catch {}
    await sendOrderEmails({
      orderNumber,
      date: new Date().toLocaleString("en-US"),
      productName: product.name,
      qty,
      color: colorStr,
      colorRequest,
      text,
      uploadUrl: uploadUrl ? new URL(uploadUrl, origin).href : null,
      uploadName: body.uploadName,
      paid: `$${(totalCents / 100).toFixed(2)} (DEMO — no payment taken)`,
      customerName: "Demo customer",
      customerEmail: null,
      shipTo: "(demo mode — no address collected)",
      note: "Demo order: Stripe is not configured yet, no payment was taken.",
    });
    return NextResponse.json({ url: `${origin}/thank-you?order=${orderNumber}&demo=1` });
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      quantity: qty,
      price_data: {
        currency: shop.currency,
        unit_amount: unitCents,
        product_data: {
          name: product.name,
          description: optionSummary.slice(0, 500),
          images: [new URL(product.photos[0], origin).href],
        },
      },
    }],
    shipping_address_collection: { allowed_countries: ["US"] },
    shipping_options: [{
      shipping_rate_data: {
        display_name: "Flat shipping",
        type: "fixed_amount",
        fixed_amount: { amount: shop.shippingCents, currency: shop.currency },
      },
    }],
    phone_number_collection: { enabled: true },
    metadata: {
      slug: product.slug,
      productName: product.name,
      qty: String(qty),
      color: colorStr,
      colorRequest: colorRequest || "",
      text: text || "",
      uploadUrl: uploadUrl || "",
      uploadName: body.uploadName || "",
    },
    success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/products/${product.slug}?cancelled=1`,
  });
  return NextResponse.json({ url: session.url });
}
