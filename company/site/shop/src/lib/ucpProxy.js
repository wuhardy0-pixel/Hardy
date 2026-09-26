// The store speaks the Universal Commerce Protocol through Hardy's server
// (company/corporate, port 5000 on the same machine). Shopify's own shopping
// agent expects these exact paths on the shop domain, so we proxy them here:
//   /.well-known/ucp   → the profile        /api/ucp/mcp → catalog, cart, checkout tools
//   /api/mcp           → the policies tool  (same MCP handler)
// The request reaches the server from this machine (so it is trusted); the real
// visitor's address travels in X-Hardy-Client-IP for rate limiting only.
const UPSTREAM = process.env.UCP_UPSTREAM || "http://127.0.0.1:5000";
export async function proxy(request, path) {
  const body = request.method === "POST" ? await request.text() : undefined;
  const headers = { "X-Hardy-Public-Host": "shop.hardywu.com" };
  const copy = (name, as) => { const v = request.headers.get(name); if (v) headers[as || name] = v; };
  copy("content-type", "Content-Type"); copy("accept", "Accept"); copy("ucp-agent", "UCP-Agent"); copy("user-agent", "User-Agent");
  const ip = request.headers.get("cf-connecting-ip") || (request.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (ip) headers["X-Hardy-Client-IP"] = ip;
  const res = await fetch(UPSTREAM + path, { method: request.method, body, headers, cache: "no-store" });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { "Content-Type": res.headers.get("content-type") || "application/json", "Cache-Control": "no-store" } });
}
