import { NextResponse } from "next/server";
import { sendOrderEmails } from "../../../lib/orderEmail";

// Stripe calls this after a successful payment. This — not the thank-you page —
// is what triggers the order email, so an order can never be missed because
// the customer closed the tab.
export async function POST(request) {
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const payload = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      request.headers.get("stripe-signature"),
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const m = s.metadata || {};
    const addr = s.shipping_details?.address || s.customer_details?.address || {};
    const shipTo = [
      s.shipping_details?.name || s.customer_details?.name,
      addr.line1,
      addr.line2,
      [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
      addr.country,
    ].filter(Boolean).join("\n");

    await sendOrderEmails({
      orderNumber: String(s.created).slice(-6),
      date: new Date(s.created * 1000).toLocaleString("en-US"),
      productName: m.productName || m.slug,
      qty: m.qty || "1",
      color: m.color,
      colorRequest: m.colorRequest || null,
      text: m.text || null,
      uploadUrl: m.uploadUrl || null,
      uploadName: m.uploadName || null,
      paid: `$${(s.amount_total / 100).toFixed(2)} (incl. shipping)`,
      customerName: s.customer_details?.name,
      customerEmail: s.customer_details?.email,
      customerPhone: s.customer_details?.phone,
      shipTo,
    });
    // If sendOrderEmails threw, we return 500 below and Stripe retries the
    // webhook automatically — the order is never silently lost.
  }
  return NextResponse.json({ received: true });
}
