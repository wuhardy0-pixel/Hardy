import { shop, products } from "../../lib/catalog";
import { MARKUP } from "./markup";
import { SITE, SIGNIN } from "../layout";

export const metadata = { title: "Make your own — Hardy's 3D playground" };
export const dynamic = "force-dynamic";

// The playground, as agreed in company/site/mocks/v2/make.html: sign in → My projects → six animated steps.
// The screens are plain HTML (./markup.js) brought to life by /make/studio.js; the models, colours and
// prices come from the catalog, so the price here is the price at checkout.
export default function Make() {
  const order = (p) => (p.slug === "customizable-lunchbox" ? 0 : 1);   // the lunchbox first
  const models = Object.fromEntries(products.filter((p) => (p.text || p.image) && p.in_stock !== false).sort((a, b) => order(a) - order(b)).map((p) => [p.slug, {
    name: p.name, short: p.name.replace(/^(Customizable|Blue) /, ""), price: p.price, photo: p.photos[0],
    zones: p.zones || ["Color"], textZone: p.preview?.canvasTextZone || null, hours: p.cost?.printHours || 2,
  }]));
  const next = process.env.PREVIEW_SITE ? "http://127.0.0.1:3011/make" : "/make";
  const data = { signin: `${SIGNIN}?next=${encodeURIComponent(next)}`, site: SITE, models, colors: shop.colors.map((c) => [c.name, c.hex, c.stock === "low"]), addons: shop.addons || { text: 1.99, image: 3.49, extraColor: 3.49 } };
  return (
    <>
      <link rel="stylesheet" href="/make/studio.css" />
      <script dangerouslySetInnerHTML={{ __html: `window.__PLAY=${JSON.stringify(data).replace(/</g, "\\u003c")};` }} />
      <div id="studio" dangerouslySetInnerHTML={{ __html: MARKUP }} />
      <script src="/make/studio.js" defer />
    </>
  );
}
