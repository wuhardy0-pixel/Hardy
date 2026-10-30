"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Featured pieces on a spinning turntable (mock C): turns by itself, or with the arrows, a swipe or the arrow keys.
export default function Turntable({ items }) {
  const N = items.length, R = 420, step = 360 / N;
  const [i, setI] = useState(0);
  const auto = useRef(null), sx = useRef(null);
  const restart = () => { clearInterval(auto.current); if (!matchMedia("(prefers-reduced-motion: reduce)").matches) auto.current = setInterval(() => setI((v) => v + 1), 3800); };
  useEffect(() => { restart(); return () => clearInterval(auto.current); }, []);
  const go = (d) => { setI((v) => v + d); restart(); };
  const k = ((i % N) + N) % N, front = items[k];
  return (
    <div className="stage surface" tabIndex={0} aria-label="Featured pieces"
      onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}
      onPointerDown={(e) => (sx.current = e.clientX)}
      onPointerUp={(e) => { if (sx.current !== null && Math.abs(e.clientX - sx.current) > 40) go(e.clientX < sx.current ? 1 : -1); sx.current = null; }}>
      <div className="plate" aria-hidden="true" />
      <div className="scene"><div className="ring" style={{ transform: `translateZ(-${R}px) rotateY(${-i * step}deg)` }}>
        {items.map((p, j) => (
          <Link key={p.slug} href={`/products/${p.slug}`} className={`toy3${j === k ? " front" : ""}`} tabIndex={j === k ? 0 : -1}
            style={{ transform: `rotateY(${j * step}deg) translateZ(${R}px) rotateY(${i * step - j * step}deg)` }}>
            <div className="c"><img src={p.photos[0]} alt={p.name} /><div><b>{p.name}</b><span>${p.price.toFixed(2)}</span></div></div>
          </Link>
        ))}
      </div></div>
      <div className="controls">
        <button className="round press" onClick={() => go(-1)} aria-label="Turn left"><svg className="i" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6" /></svg></button>
        <div className="now" aria-live="polite">{front.name} · ${front.price.toFixed(2)}<Link href={`/products/${front.slug}`}>See it →</Link></div>
        <button className="round press" onClick={() => go(1)} aria-label="Turn right"><svg className="i" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </div>
    </div>
  );
}
