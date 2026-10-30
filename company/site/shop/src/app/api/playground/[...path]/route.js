import { NextResponse } from "next/server";
// The playground's saved projects and helper allowance live on Hardy's server (corporate owns customer data);
// this passes the request through with the visitor's cookie.
export const dynamic = "force-dynamic";
const OK = new Set(["projects", "projects/delete", "helper"]);
async function pass(request, { params }) {
  const path = (params.path || []).join("/");
  if (!OK.has(path)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const res = await fetch(`http://127.0.0.1:5000/api/playground/${path}`, {
      method: request.method, cache: "no-store",
      headers: { cookie: request.headers.get("cookie") || "", "Content-Type": "application/json" },
      body: request.method === "POST" ? await request.text() : undefined,
    });
    return NextResponse.json(await res.json(), { status: res.status, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "The playground is resting. Please try again in a minute." }, { status: 502 }); }
}
export { pass as GET, pass as POST };
