import { NextResponse } from "next/server";
// Who is signed in (one sign-in for all of hardywu.com). The browser's cookie goes to the server on this machine.
export const dynamic = "force-dynamic";
export async function GET(request) {
  try {
    const res = await fetch("http://127.0.0.1:5000/api/me", { headers: { cookie: request.headers.get("cookie") || "" }, cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } }); }
}
