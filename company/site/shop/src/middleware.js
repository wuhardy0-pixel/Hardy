import { NextResponse } from "next/server";

// The live store asks visitors to sign in first (log3d.hardywu.com) so orders
// carry a name and email. Anyone with a hardywu.com sign-in cookie walks straight in.
export function middleware(request) {
  const host = request.headers.get("host") || "";
  if (host !== "shop.hardywu.com") return NextResponse.next();       // local testing etc.
  if (request.cookies.get("session")) return NextResponse.next();    // already signed in somewhere on hardywu.com
  const m = request.nextUrl.pathname.match(/^\/products\/([a-z0-9-]+)/);
  const to = "https://log3d.hardywu.com/" + (m ? `?p=${m[1]}` : "");
  return NextResponse.redirect(to, 302);
}

export const config = {
  matcher: ["/((?!api|_next|uploads|favicon.ico|thank-you).*)"],
};
