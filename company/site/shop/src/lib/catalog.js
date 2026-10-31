import catalog from "../../data/catalog.json";

export const shop = catalog;
// Retired products stay in catalog.json for old orders but are not shown or sold (Barbara 2026-10-31)
export const products = catalog.products.filter((p) => !p.retired);
export const getProduct = (slug) => products.find((p) => p.slug === slug);
// Shop = ready-made pieces; Make your own = templates the customer finishes (Barbara 2026-10-30)
export const ready = products.filter((p) => p.kind !== "template");
export const templates = products.filter((p) => p.kind === "template");
