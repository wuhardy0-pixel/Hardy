import Link from "next/link";
export const metadata = { title: "Order placed — Hardy's 3D" };

export default function ThankYou({ searchParams }) {
  const ids = (searchParams?.orders || searchParams?.order || "").split(",").filter(Boolean);
  const demo = searchParams?.demo;
  return (
    <main className="confirm">
      <div className="mark">✓</div>
      <h1>Thank you, your order is placed</h1>
      {ids.length > 0 && <p>Order number{ids.length > 1 ? "s" : ""}: <b className="mono">{ids.join(", ")}</b></p>}
      <p>Hardy will email you to confirm your colors and arrange payment, then print and ship your piece{ids.length > 1 ? "s" : ""}.</p>
      {demo && <p className="mono" style={{ fontSize: 13 }}>No payment was taken online.</p>}
      <p style={{ marginTop: 14 }}><Link href="/orders" className="btn-yellow">See your orders</Link> &nbsp; <Link href="/" className="opt">Keep shopping</Link></p>
    </main>
  );
}
