"""Shopify's own storefront agent code, pointed at Hardy's store — the proof that shop.hardywu.com
is "what it should be". Same steps as Shopify's storefront/scripts/smoke.py, with Hardy's products.

Setup (once):  git clone https://github.com/Shopify/claude-for-commerce-examples.git ~/cfce
               cd ~/cfce && python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
Run:           cd ~/cfce && .venv/bin/python /path/to/company/corporate/tests/shopify_agent_smoke.py
Needs the live site (it talks to shop.hardywu.com over the internet); no Anthropic key needed."""
import asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))
from storefront.api.shopify_backend import ShopifyStorefrontBackend
from storefront.api.ucp_client import UcpClient
from shopping_agent import ShoppingSessionContext
async def main():
    shop="shop.hardywu.com"
    backend=ShopifyStorefrontBackend(UcpClient(shop), store_name=shop)
    session=ShoppingSessionContext(session_id="smoke", user_id="guest")
    d=await backend.client.discover(); print("discovery: ucp", d["ucp"]["version"], "| caps:", ", ".join(k.split(".")[-1] for k in d["ucp"]["capabilities"]))
    products=await backend.search_products(session,"ruler",limit=3); assert products, "search returned nothing"
    first=products[0]; print(f"search: {len(products)} products, first {first.title!r} {first.price} {first.currency} in_stock={first.in_stock}")
    details=await backend.get_product_details(session, first.product_id); assert details and details.variants
    print(f"details: {len(details.variants)} variants, e.g. {details.variants[2].title!r} id={details.variants[2].product_id}")
    cart=await backend.add_to_cart(session, details.variants[2].product_id, 1); assert cart.item_count==1, cart
    url=await backend.checkout_url_for(session.session_id); assert url, "no checkout url"
    print(f"cart: added {cart.items[0].title!r}; checkout hand-off url = {url[:60]}…")
    cart=await backend.update_cart_item(session, cart.items[0].product_id, 2); assert cart.item_count==2
    gauge=(await backend.search_products(session,"crab",limit=1))[0]; gd=await backend.get_product_details(session, gauge.product_id)
    cart=await backend.add_to_cart(session, gd.variants[0].product_id, 1); print(f"cart: now {cart.item_count} items across {len(cart.items)} lines")
    cart=await backend.remove_from_cart(session, cart.items[0].product_id); print(f"cart: after remove {len(cart.items)} line(s)")
    lunch=await backend.search_products(session,"lunchbox",limit=1); print(f"sold-out check: {lunch[0].title!r} in_stock={lunch[0].in_stock}")
    pol=await backend.search_policies(session,"return policy"); print(f"policies: {len(pol)} matches, first {pol[0].title!r}")
    await backend.client.aclose(); print(f"SMOKE OK against {shop} — Shopify's own agent code shops here")
asyncio.run(main())
