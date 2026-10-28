import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(request) {
  try {
    const res = await fetch("http://127.0.0.1:5000/api/orders/mine", { headers: { cookie: request.headers.get("cookie") || "" }, cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "The order list is not available right now." }, { status: 502 }); }
}
