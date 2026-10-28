import Link from "next/link";
import { shop, products } from "../../lib/catalog";
import { reviewSummaries } from "../../lib/reviews";
import Stars from "../../components/Stars";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search — Hardy's 3D" };

const PRICE = [["under-10", "Under $10", (p) => p.price < 10], ["10-25", "$10 to $25", (p) => p.price >= 10 && p.price <= 25], ["over-25", "$25 & up", (p) => p.price > 25]];

export default async function Search({ searchParams }) {
  const k = (searchParams.k || "").trim().toLowerCase();
  const c = searchParams.c || "";
  const custom = searchParams.custom === "1";
  const price = searchParams.price || "";
  const sort = searchParams.sort || "featured";
  let list = products.filter((p) => (!k || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(k)) && (!c || p.category === c) && (!custom || p.text || p.image));
  const pr = PRICE.find(([id]) => id === price); if (pr) list = list.filter(pr[2]);
  if (sort === "low") list = [...list].sort((a, b) => a.price - b.price); if (sort === "high") list = [...list].sort((a, b) => b.price - a.price);
  const reviews = await reviewSummaries(list.map((p) => p.slug));
  const shipDays = shop.shipDays || [3, 5];
  const link = (patch) => { const q = new URLSearchParams({ ...(k && { k }), ...(c && { c }), ...(custom && { custom: "1" }), ...(price && { price }), ...(sort !== "featured" && { sort }), ...patch }); for (const [key, v] of Object.entries(patch)) if (!v) q.delete(key); return `/s?${q.toString()}`; };
  return (
    <main className="results">
      <aside className="filters">
        <h4>Category</h4>
        <Link href={link({ c: "" })} className={!c ? "on" : ""}>All</Link>
        {(shop.categories || []).map((x) => <Link key={x} href={link({ c: x })} className={c === x ? "on" : ""}>{x}</Link>)}
        <h4>Price</h4>
        <Link href={link({ price: "" })} className={!price ? "on" : ""}>Any price</Link>
        {PRICE.map(([id, label]) => <Link key={id} href={link({ price: id })} className={price === id ? "on" : ""}>{label}</Link>)}
        <h4>Personalization</h4>
        <Link href={link({ custom: "" })} className={!custom ? "on" : ""}>Everything</Link>
        <Link href={link({ custom: "1" })} className={custom ? "on" : ""}>Name or picture</Link>
        <h4>Colors in stock</h4>
        {shop.colors.map((col) => <span key={col.name} style={{ display: "block", fontSize: 12.5 }}><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: col.hex, border: "1px solid #bbb", marginRight: 6 }} />{col.name}{col.stock === "low" ? " · only a little left" : ""}</span>)}
      </aside>
      <section>
        <div className="res-head">
          <span>{list.length} result{list.length === 1 ? "" : "s"}{k ? <> for <b>“{searchParams.k}”</b></> : ""}{c ? <> in <b>{c}</b></> : ""}</span>
          <span>Sort: {[["featured", "Featured"], ["low", "Price: low to high"], ["high", "Price: high to low"]].map(([id, label], i) => <span key={id}>{i ? " · " : ""}{sort === id ? <b>{label}</b> : <Link href={link({ sort: id })}>{label}</Link>}</span>)}</span>
        </div>
        {list.length === 0 && <div className="empty"><h2>No results</h2><p>Try another word, or <Link href="/s">see everything</Link>.</p></div>}
        {list.map((p) => { const r = reviews[p.slug] || {}; return (
          <article className="res-item" key={p.slug}>
            <Link href={`/products/${p.slug}`}><img src={p.photos[0]} alt={p.name} loading="lazy" /></Link>
            <div>
              <h3><Link href={`/products/${p.slug}`}>{p.name}</Link></h3>
              <Stars average={r.average} count={r.count} size={14} />
              <div className="pc-price"><sup>$</sup>{Math.floor(p.price)}<small>{Math.round((p.price % 1) * 100).toString().padStart(2, "0")}</small></div>
              <div className="pc-meta">{p.in_stock === false ? <span className="soldout">Sold out</span> : <span className="instock">In stock · made to order</span>}<span>Ships in {shipDays[0]}–{shipDays[1]} days · <b>FREE shipping</b></span></div>
              <p>{p.description}</p>
              <Link href={`/products/${p.slug}`} className="btn-yellow">Choose options</Link>
            </div>
          </article>); })}
      </section>
    </main>
  );
}
