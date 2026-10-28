import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const UP = "http://127.0.0.1:5000/api/reviews/";
export async function GET(request, { params }) {
  try { const res = await fetch(UP + encodeURIComponent(params.slug), { cache: "no-store" }); return NextResponse.json(await res.json(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ reviews: [], count: 0, average: null }); }
}
export async function POST(request, { params }) {
  try {
    const res = await fetch(UP + encodeURIComponent(params.slug), { method: "POST", headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") || "" }, body: await request.text(), cache: "no-store" });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch { return NextResponse.json({ error: "Could not save the review right now." }, { status: 502 }); }
}
