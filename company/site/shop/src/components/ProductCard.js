import Link from "next/link";
import Stars from "./Stars";

export default function ProductCard({ p, reviews, shipDays }) {
  const r = reviews?.[p.slug] || {};
  const custom = [p.text && "name", p.image && "picture"].filter(Boolean);
  return (
    <article className="pc">
      <Link href={`/products/${p.slug}`} className="pc-img"><img src={p.photos[0]} alt={p.name} loading="lazy" /></Link>
      <div className="pc-body">
        <Link href={`/products/${p.slug}`} className="pc-title">{p.name}</Link>
        <Stars average={r.average} count={r.count} size={14} />
        <div className="pc-price"><sup>$</sup>{Math.floor(p.price)}<small>{Math.round((p.price % 1) * 100).toString().padStart(2, "0")}</small></div>
        <div className="pc-meta">
          {p.in_stock === false ? <span className="soldout">Sold out</span> : <span className="instock">In stock · made to order</span>}
          <span>Ships in {shipDays[0]}–{shipDays[1]} days · <b>FREE shipping</b></span>
          <span>{p.multicolored ? "Multicolored as shown" : "Your color"}{custom.length ? ` · your ${custom.join(" and ")}` : ""}</span>
        </div>
        <Link href={`/products/${p.slug}`} className="btn-yellow">{p.in_stock === false ? "See details" : "Choose options"}</Link>
      </div>
    </article>
  );
}
