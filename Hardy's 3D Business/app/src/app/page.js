import Link from "next/link";
import { shop, products } from "../lib/catalog";

const tagline = (p) => {
  const tags = [];
  if (p.multicolored) tags.push("multicolored");
  else tags.push("your color");
  if (p.text) tags.push("custom text");
  if (p.image) tags.push("your image");
  return tags.join(" · ");
};

export default function Home() {
  return (
    <main>
      <section className="hero">
        <h1 className="display">3D-printed pieces, made just for you</h1>
        <p>
          Pick a design, choose your color, add a name or your own photo —
          and I&rsquo;ll print it and ship it to your door.
        </p>
        <Link href="/#products" className="btn">Browse products</Link>
      </section>

      <h2 className="section-title" id="products">All products · {products.length}</h2>
      <section className="grid">
        {products.map((p) => (
          <Link key={p.slug} href={`/products/${p.slug}`} className="card">
            <div className="thumb"><img src={p.photos[0]} alt={p.name} loading="lazy" /></div>
            <div className="card-body">
              <h3>{p.name}</h3>
              <div className="tags">{tagline(p)}</div>
              <div className="price">${p.price}</div>
            </div>
          </Link>
        ))}
      </section>

      <section className="about" id="about">
        <h2 className="display">About the shop</h2>
        <p>{shop.about}</p>
      </section>
    </main>
  );
}
