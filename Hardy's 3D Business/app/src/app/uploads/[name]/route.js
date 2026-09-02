import { NextResponse } from "next/server";

const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif" };

// Serves locally stored customer uploads (dev / no-Blob fallback).
export async function GET(_request, { params }) {
  const name = String(params.name).replace(/[^\w.\-]+/g, "_");
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  try {
    const buf = await readFile(path.join(process.cwd(), ".uploads", name));
    const ext = name.split(".").pop().toLowerCase();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": TYPES[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
