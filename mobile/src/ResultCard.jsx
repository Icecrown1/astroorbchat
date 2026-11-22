export function ResultCard({ title, eyebrow, meta, children }) {
  return <article className="result-card forecast-result">
    <div className="result-heading">
      {eyebrow && <p className="result-eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {meta && <p className="result-meta">{meta}</p>}
    </div>
    <div className="result-body">{children}</div>
  </article>;
}
