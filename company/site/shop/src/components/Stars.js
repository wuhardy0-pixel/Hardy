// Amazon-style star row. Real reviews only: with none, the row says so instead of showing fake stars.
export default function Stars({ average, count, size = 16, link }) {
  if (!count) return <span className="stars none" style={{ fontSize: size - 3 }}>No reviews yet{link ? <> · <a href={link}>be the first</a></> : null}</span>;
  const full = Math.round(average);
  return (
    <span className="stars" style={{ fontSize: size }} title={`${average} out of 5`}>
      <span className="star-row" aria-hidden="true">{"★★★★★".slice(0, full)}<span className="dim">{"★★★★★".slice(full)}</span></span>
      <span className="star-n">{average} · {count} review{count === 1 ? "" : "s"}</span>
    </span>
  );
}
