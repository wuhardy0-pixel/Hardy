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
  const others = products.filter((p) => p.slug !== product.slug);
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
    <Customizer product={product} colors={shop.colors} shippingCents={shop.shippingCents} shipDays={shop.shipDays || [3, 5]} initialReviews={r} />
    {others.length > 0 && (
      <section className="row-box">
        <h2>Customers also look at</h2>
        <div className="grid">{others.map((p) => <ProductCard key={p.slug} p={p} reviews={reviews} shipDays={shop.shipDays || [3, 5]} />)}</div>
      </section>
    )}
  </>);
}
