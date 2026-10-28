"use client";
// The shopping cart lives in the browser (localStorage) until checkout, like any store.
// Each line: {id, slug, name, photo, qty, colors, colorRequest, text, uploadUrl, uploadName, unitCents, summary}
import { useEffect, useState } from "react";

const KEY = "hardys3d-cart";
const listeners = new Set();
function read() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function write(items) { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} listeners.forEach((fn) => fn(items)); }

export const cart = {
  items: read,
  add(line) {
    const items = read();
    // same product with the same options → one line, more quantity
    const same = items.find((x) => x.slug === line.slug && x.summary === line.summary && x.uploadUrl === line.uploadUrl);
    if (same) same.qty = Math.min(9, same.qty + line.qty); else items.push({ ...line, id: `${line.slug}-${Date.now().toString(36)}` });
    write(items); return items;
  },
  setQty(id, qty) { const items = read().map((x) => (x.id === id ? { ...x, qty: Math.max(1, Math.min(9, qty)) } : x)); write(items); },
  remove(id) { write(read().filter((x) => x.id !== id)); },
  clear() { write([]); },
  count() { return read().reduce((n, x) => n + x.qty, 0); },
  subtotalCents(items) { return (items || read()).reduce((n, x) => n + x.unitCents * x.qty, 0); },
};

export function useCart() {
  const [items, setItems] = useState([]);
  useEffect(() => { setItems(read()); const fn = (i) => setItems([...i]); listeners.add(fn);
    const onStorage = (e) => { if (e.key === KEY) setItems(read()); }; addEventListener("storage", onStorage);
    return () => { listeners.delete(fn); removeEventListener("storage", onStorage); }; }, []);
  return items;
}
export const money = (cents) => `$${(cents / 100).toFixed(2)}`;
