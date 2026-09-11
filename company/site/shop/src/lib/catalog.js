import catalog from "../../data/catalog.json";

export const shop = catalog;
export const products = catalog.products;
export const getProduct = (slug) => catalog.products.find((p) => p.slug === slug);
