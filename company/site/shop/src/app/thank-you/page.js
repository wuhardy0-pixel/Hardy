export const metadata = { title: "Order confirmed — Hardy's 3D" };

export default function ThankYou({ searchParams }) {
  const demo = searchParams?.demo;
  const order = searchParams?.order;
  return (
    <main className="confirm">
      <div className="mark">✓</div>
      <h1 className="display">Your order is in!</h1>
      {order && <p>Order <span className="mono">#{order}</span></p>}
      <p>A confirmation was sent to your email. Barbara will print your piece and ship it to you.</p>
      {demo && <p className="mono" style={{ fontSize: 13 }}>(Demo mode — no payment was taken.)</p>}
      <p>Questions? Just reply to the confirmation email.</p>
    </main>
  );
}
