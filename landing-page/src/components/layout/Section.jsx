export default function Section({ id, eyebrow, title, intro, tone = "light", children, className = "" }) {
  return (
    <section id={id} className={`section section--${tone} ${className}`}>
      <div className="shell">
        {(eyebrow || title || intro) && (
          <header className="section-heading">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2>{title}</h2>}
            {intro && <p className="section-intro">{intro}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
