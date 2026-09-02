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
  return <Customizer product={product} colors={shop.colors} shippingCents={shop.shippingCents} />;
}
