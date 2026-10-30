import Link from "next/link";
import Stars from "./Stars";

// A squishy clay card (the shop prototype, mock F). The + opens the product, where the colour is chosen.
export default function ProductCard({ p, reviews, shipDays }) {
  const r = reviews?.[p.slug] || {};
  const custom = p.text || p.image;
  return (
    <article className="pc">
      <Link href={`/products/${p.slug}`} className="pc-img">
        <img src={p.photos[0]} alt={p.name} loading="lazy" />
        {custom && <span className="pc-mk">make it yours</span>}
      </Link>
      <div className="pc-body">
        <Link href={`/products/${p.slug}`} className="pc-title">{p.name}</Link>
        <Stars average={r.average} count={r.count} size={14} />
        <div className="pc-row">
          <div>
            <div className="pc-price">${p.price.toFixed(2)}</div>
            <div className="pc-meta">
              {p.in_stock === false ? <span className="soldout">Sold out</span> : <span>Ships in {shipDays[0]}–{shipDays[1]} days · free</span>}
            </div>
          </div>
          <Link href={`/products/${p.slug}`} className="add" aria-label={`Choose options for ${p.name}`}>
            <svg className="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
