import Link from "next/link";
import { shop, ready, templates } from "../lib/catalog";
import { reviewSummaries } from "../lib/reviews";
import ProductCard from "../components/ProductCard";
import Turntable from "../components/Turntable";

export const dynamic = "force-dynamic";

// The shop: ready-made pieces only (templates such as the lunchbox live in Make your own, Barbara 2026-10-30).
// Featured pieces spin on a turntable, then everything ready-made as clay cards.
// (The "Printed to order" printing headline moved to the playground's sign-in screen, Barbara 2026-10-30.)
const FEATURED = ["crab-gauge", "dual-ruler"];   // Hardy can reorder these

export default async function Home() {
  const reviews = await reviewSummaries(ready.map((p) => p.slug));
  const shipDays = shop.shipDays || [3, 5];
  const featured = [...FEATURED.map((s) => ready.find((p) => p.slug === s)).filter(Boolean), ...ready.filter((p) => !FEATURED.includes(p.slug))]
    .filter((p) => p.in_stock !== false).slice(0, 6);
  return (
    <main>
      {featured.length >= 3 && (
        <section className="sec" style={{ marginTop: 22 }}>
          <div className="sec-head"><h2>Featured</h2><p>Spin the table. Tap the front one to see it.</p></div>
          <Turntable items={featured} />
        </section>
      )}

      <section className="sec" id="all">
        <div className="sec-head"><h2>Everything ready-made</h2><p>Pick the colour, and Hardy prints it for you.</p></div>
        <div className="grid">{ready.map((p) => <ProductCard key={p.slug} p={p} reviews={reviews} shipDays={shipDays} />)}</div>
      </section>

      <section className="sec">
        <div className="makeown"><div><h2>Want one that's all yours?</h2><p>Start from a template{templates.length ? ` like the ${templates[0].name.replace(/^Customizable /, "").toLowerCase()}` : ""}, add your own picture and name, and pay only when you print.</p></div>
          <a className="btn press" href="/make">Make your own →</a></div>
      </section>

    </main>
  );
}
