import Link from "next/link";
import { shop, products } from "../lib/catalog";
import { reviewSummaries } from "../lib/reviews";
import ProductCard from "../components/ProductCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const reviews = await reviewSummaries(products.map((p) => p.slug));
  const lunch = products.find((p) => p.slug === "customizable-lunchbox") || products[0];
  const cats = shop.categories || [];
  const shipDays = shop.shipDays || [3, 5];
  return (
    <main>
      <section className="hero">
        <div className="hero-text">
          <div className="kicker">Back in stock</div>
          <h1>The customizable lunchbox — your colors, your name on the lid</h1>
          <p>Pick the box and lid colors, add a name, and Hardy prints it to order. Free shipping anywhere in the US.</p>
          <Link href={`/products/${lunch.slug}`} className="btn-yellow">Customize yours · ${lunch.price}</Link>
        </div>
        <div className="hero-img"><img src={lunch.photos[0]} alt={lunch.name} /></div>
      </section>

      <section className="tiles">
        {cats.map((c) => {
          const p = products.find((x) => x.category === c);
          return (
            <Link key={c} href={`/s?c=${encodeURIComponent(c)}`} className="tile">
              <h3>{c}</h3>
              {p && <img src={p.photos[0]} alt={c} loading="lazy" />}
              <span>Shop {c.toLowerCase()} →</span>
            </Link>
          );
        })}
        <Link href="/s?custom=1" className="tile">
          <h3>Make it yours</h3>
          <img src="/products/crab-gauge/preview/frames/front_3.webp" alt="Customizable" loading="lazy" />
          <span>Everything with your color, name or picture →</span>
        </Link>
      </section>

      <section className="row-box" id="products">
        <h2>All products · made to order by Hardy</h2>
        <div className="grid">
          {products.map((p) => <ProductCard key={p.slug} p={p} reviews={reviews} shipDays={shipDays} />)}
        </div>
      </section>

      <section className="about" id="about">
        <h2>About the shop</h2>
        <p>{shop.about}</p>
      </section>
    </main>
  );
}
