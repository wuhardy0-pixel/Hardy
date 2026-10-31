import { notFound } from "next/navigation";
import { shop, products, getProduct } from "../../../lib/catalog";
import { reviewSummaries } from "../../../lib/reviews";
import Customizer from "../../../components/Customizer";
import ProductCard from "../../../components/ProductCard";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }) {
  const p = getProduct(params.slug);
  return p ? { title: `${p.name} — ${shop.shopName}` } : {};
}

export default async function ProductPage({ params }) {
  const product = getProduct(params.slug);
  if (!product) notFound();
  const reviews = await reviewSummaries(products.map((p) => p.slug));
  const others = products.filter((p) => p.slug !== product.slug && p.kind !== "template");   // suggestions come from the Shop
  // schema.org Product data so search engines and AI shopping agents understand the page
  const r = reviews[product.slug] || {};
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.description,
    image: (product.photos || []).map((ph) => `https://shop.hardywu.com${ph}`), brand: { "@type": "Brand", name: "Hardy Wu" },
    ...(r.count ? { aggregateRating: { "@type": "AggregateRating", ratingValue: r.average, reviewCount: r.count } } : {}),
    offers: { "@type": "Offer", price: product.price.toFixed(2), priceCurrency: shop.currency.toUpperCase(),
      availability: product.in_stock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", url: `https://shop.hardywu.com/products/${product.slug}`,
      shippingDetails: { "@type": "OfferShippingDetails", shippingRate: { "@type": "MonetaryAmount", value: (shop.shippingCents / 100).toFixed(2), currency: "USD" } } },
    additionalProperty: [{ "@type": "PropertyValue", name: "colors", value: shop.colors.map((c) => c.name).join(", ") },
      { "@type": "PropertyValue", name: "agent_checkout", value: "https://play.hardywu.com/openapi.json" }],
  };
  return (<>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    <Customizer product={product} colors={shop.colors} shippingCents={shop.shippingCents} shipDays={shop.shipDays || [3, 5]} initialReviews={r} addons={shop.addons} />
    {/* Amazon-style details under the buy box, when the catalog has them (Barbara 2026-10-31) */}
    {(product.videos || []).map((v) => (
      <section className="sec pdp-more" key={v.src}><div className="sec-head"><h2>{v.title || "Watch how it works"}</h2></div>
        <div className="pdp-video"><video controls preload="metadata" poster={v.poster} src={v.src} /><div><h3>{v.length}</h3><p>{v.blurb}</p></div></div></section>
    ))}
    {product.problem?.length > 0 && (
      <section className="sec pdp-more"><div className="sec-head"><h2>The problem it solves</h2></div>
        <div className="pdp-problem">{product.problem.map(([h, t]) => <div key={h}><h3>{h}</h3><p>{t}</p></div>)}</div></section>
    )}
    {product.facts?.length > 0 && (
      <section className="sec pdp-more"><div className="sec-head"><h2>Product details</h2></div>
        <dl className="pdp-facts">{product.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
    )}
    {product.aplus?.length > 0 && (
      <section className="sec pdp-more"><div className="sec-head"><h2>From the maker</h2></div>
        <div className="pdp-aplus">{product.aplus.map((i) => <img key={i} src={product.photos[i - 1]} alt="" loading="lazy" />)}</div></section>
    )}
    {product.qa?.length > 0 && (
      <section className="sec pdp-more"><div className="sec-head"><h2>Questions and answers</h2></div>
        <dl className="pdp-qa">{product.qa.map(([q, a]) => <div key={q}><dt>{q}</dt><dd>{a}</dd></div>)}</dl></section>
    )}
    {others.length > 0 && (
      <section className="sec">
        <div className="sec-head"><h2>Customers also look at</h2></div>
        <div className="grid">{others.map((p) => <ProductCard key={p.slug} p={p} reviews={reviews} shipDays={shop.shipDays || [3, 5]} />)}</div>
      </section>
    )}
  </>);
}
