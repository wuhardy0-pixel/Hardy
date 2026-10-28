// Review summaries for product cards, read from Hardy's server on this machine (never fails the page).
export async function reviewSummaries(slugs) {
  const out = {};
  await Promise.all(slugs.map(async (s) => {
    try { const r = await fetch(`http://127.0.0.1:5000/api/reviews/${encodeURIComponent(s)}`, { cache: "no-store" }); const d = await r.json(); out[s] = { average: d.average, count: d.count, reviews: d.reviews || [] }; }
    catch { out[s] = { average: null, count: 0, reviews: [] }; }
  }));
  return out;
}
