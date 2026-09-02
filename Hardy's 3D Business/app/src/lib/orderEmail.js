import { Resend } from "resend";

const OWNER_EMAIL = process.env.OWNER_EMAIL || "barbaratao@gmail.com";
const FROM = process.env.EMAIL_FROM || "Hardy's 3D <onboarding@resend.dev>";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const row = (k, v) =>
  v
    ? `<tr><td style="padding:5px 14px 5px 0;color:#5b6670;font-family:Menlo,monospace;font-size:12px;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:5px 0">${v}</td></tr>`
    : "";

export function orderEmailHtml(o) {
  return `
  <div style="font-family:'Avenir Next','Segoe UI',system-ui,sans-serif;color:#232a33;font-size:14.5px">
    <table style="border-collapse:collapse">
      ${row("ORDER", `#${esc(o.orderNumber)} · ${esc(o.date)}`)}
      ${row("PRODUCT", `${esc(o.productName)} × ${o.qty}`)}
      ${row("COLOR", esc(o.color))}
      ${row("COLOR REQUEST", o.colorRequest ? `&ldquo;${esc(o.colorRequest)}&rdquo;` : "")}
      ${row("TEXT", o.text ? `&ldquo;${esc(o.text)}&rdquo;` : "")}
      ${row("IMAGE", o.uploadUrl ? `<a href="${esc(o.uploadUrl)}">Download ${esc(o.uploadName || "image")}</a>` : "")}
      ${row("PAID", esc(o.paid))}
      ${row("CUSTOMER", `${esc(o.customerName)} · ${esc(o.customerEmail)}${o.customerPhone ? " · " + esc(o.customerPhone) : ""}`)}
      ${row("SHIP TO", esc(o.shipTo).replace(/\n/g, "<br>"))}
      ${row("NOTE", o.note ? esc(o.note) : "")}
    </table>
  </div>`;
}

export async function sendOrderEmails(o) {
  const subject = `New order #${o.orderNumber} — ${o.productName} — ${o.paid}`;
  if (!process.env.RESEND_API_KEY) {
    console.log("[order email — RESEND_API_KEY not set, logging instead]", subject, JSON.stringify(o, null, 2));
    return { logged: true };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  // owner email is the critical one — throw on failure so callers can retry
  await resend.emails.send({
    from: FROM,
    to: OWNER_EMAIL,
    subject,
    html: orderEmailHtml(o),
  });
  // customer confirmation is best-effort
  if (o.customerEmail) {
    try {
      await resend.emails.send({
        from: FROM,
        to: o.customerEmail,
        subject: `Your Hardy's 3D order #${o.orderNumber} is in!`,
        html: `<div style="font-family:'Avenir Next','Segoe UI',system-ui,sans-serif;color:#232a33">
          <p>Thanks, ${esc(o.customerName || "friend")}! Your order <b>#${esc(o.orderNumber)}</b> — ${esc(o.productName)} — is confirmed.</p>
          <p>Barbara will print your piece and ship it to you. Questions? Just reply to this email.</p>
        </div>`,
        reply_to: OWNER_EMAIL,
      });
    } catch (e) {
      console.error("customer confirmation email failed", e);
    }
  }
  return { sent: true };
}
