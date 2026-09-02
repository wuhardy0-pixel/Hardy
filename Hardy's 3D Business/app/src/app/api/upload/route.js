import { NextResponse } from "next/server";

const MAX_BYTES = 10 * 1024 * 1024;
const OK_EXT = /\.(jpe?g|png|heic|heif)$/i;

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const filename = (searchParams.get("filename") || "upload.jpg").replace(/[^\w.\-]+/g, "_");
  if (!OK_EXT.test(filename)) {
    return NextResponse.json({ error: "Only JPG, PNG, or HEIC images are accepted." }, { status: 400 });
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image is larger than 10 MB." }, { status: 400 });
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`orders/${Date.now()}-${filename}`, body, {
      access: "public",
      contentType: request.headers.get("content-type") || undefined,
    });
    return NextResponse.json({ url: blob.url });
  }

  // Local fallback: store outside public/ (files added to public/ after build
  // are not served by `next start`) and serve via /uploads/[name]/route.js.
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), ".uploads");
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${filename}`;
  await writeFile(path.join(dir, name), Buffer.from(body));
  return NextResponse.json({ url: `/uploads/${name}` });
}
