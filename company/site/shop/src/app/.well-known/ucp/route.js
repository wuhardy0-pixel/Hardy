import { proxy } from "../../../lib/ucpProxy";
export const dynamic = "force-dynamic";
export async function GET(request) { return proxy(request, "/.well-known/ucp"); }
export async function POST(request) { return proxy(request, "/.well-known/ucp"); }
export async function DELETE(request) { return proxy(request, "/.well-known/ucp"); }
