export default function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div>
          <a className="brand brand--footer" href="#top">
            <span className="brand-mark" aria-hidden="true">
              ▲
            </span>
            Wander North
          </a>
          <p>Ontario, Canada</p>
          <p className="muted">
            Spontaneous exploration without hours of planning.
          </p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#how-it-works">How It Works</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
          <a href="#waitlist">Early Access</a>
        </nav>
        <nav aria-label="Legal and contact navigation">
          <a href="/privacy-policy">Privacy</a>
          <a href="#legal-note">
            Terms <span>(coming soon)</span>
          </a>
          <a href="mailto:rob@websmithcreations.ca">Contact</a>
        </nav>
      </div>
      <div className="shell footer-bottom" id="legal-note">
        <span>© {new Date().getFullYear()} Wander North.</span>
        <span>Terms are pending review.</span>
      </div>
    </footer>
  );
}
