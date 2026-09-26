import { notFound } from "next/navigation";
import { shop, products, getProduct } from "../../../lib/catalog";
import Customizer from "../../../components/Customizer";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }) {
  const p = getProduct(params.slug);
  return p ? { title: `${p.name} — ${shop.shopName}` } : {};
}

export default function ProductPage({ params }) {
  const product = getProduct(params.slug);
  if (!product) notFound();
  // schema.org Product data so search engines and AI shopping agents understand the page
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.description,
    image: (product.photos || []).map((ph) => `https://shop.hardywu.com${ph}`), brand: { "@type": "Brand", name: "Hardy Wu" },
    offers: { "@type": "Offer", price: product.price.toFixed(2), priceCurrency: shop.currency.toUpperCase(),
      availability: product.in_stock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", url: `https://shop.hardywu.com/products/${product.slug}`,
      shippingDetails: { "@type": "OfferShippingDetails", shippingRate: { "@type": "MonetaryAmount", value: (shop.shippingCents / 100).toFixed(2), currency: "USD" } } },
    additionalProperty: [{ "@type": "PropertyValue", name: "colors", value: shop.colors.map((c) => c.name).join(", ") },
      { "@type": "PropertyValue", name: "agent_checkout", value: "https://play.hardywu.com/openapi.json" }],
  };
  return (<>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    <Customizer product={product} colors={shop.colors} shippingCents={shop.shippingCents} />
  </>);
}
