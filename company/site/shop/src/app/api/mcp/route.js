import { proxy } from "../../../lib/ucpProxy";
export const dynamic = "force-dynamic";
export async function GET(request) { return proxy(request, "/ucp/mcp"); }
export async function POST(request) { return proxy(request, "/ucp/mcp"); }
export async function DELETE(request) { return proxy(request, "/ucp/mcp"); }
