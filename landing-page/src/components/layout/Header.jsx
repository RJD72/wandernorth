import { useEffect, useState } from "react";
import { trackEvent } from "../../services/analyticsService.js";

const links = [
  ["How It Works", "how-it-works"],
  ["Why Wander North", "why"],
  ["Features", "features"],
  ["FAQ", "faq"],
];

export default function Header() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const follow = () => setOpen(false);

  return (
    <header className="site-header">
      <div className="shell nav-wrap">
        <a className="brand" href="#top" aria-label="Wander North home">
          <span className="brand-mark" aria-hidden="true">
            ▲
          </span>
          <span>Wander North</span>
        </a>
        <button
          className="menu-button"
          type="button"
          aria-expanded={open}
          aria-controls="site-navigation"
          onClick={() => setOpen(!open)}
        >
          <span className="sr-only">{open ? "Close" : "Open"} navigation</span>
          <span aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
        <nav
          id="site-navigation"
          className={open ? "site-nav is-open" : "site-nav"}
          aria-label="Main navigation"
        >
          {links.map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={follow}>
              {label}
            </a>
          ))}
          <a
            className="button button--small"
            href="#waitlist"
            onClick={() => {
              follow();
              trackEvent("header_cta_clicked");
            }}
          >
            Join Early Access
          </a>
        </nav>
      </div>
    </header>
  );
}
