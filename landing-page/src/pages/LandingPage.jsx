import Header from "../components/layout/Header.jsx";
import Footer from "../components/layout/Footer.jsx";
import Section from "../components/layout/Section.jsx";
import MediaPlaceholder from "../components/media/MediaPlaceholder.jsx";
import HeroMedia from "../components/media/HeroMedia.jsx";
import WaitlistForm from "../components/forms/WaitlistForm.jsx";
import TripPreview from "../components/landing/TripPreview.jsx";
import {
  benefits,
  faqs,
  features,
  problems,
  steps,
  useCases,
} from "../data/landingContent.js";
import { mediaAssets } from "../data/mediaAssets.js";
import { trackEvent } from "../services/analyticsService.js";

export default function LandingPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <Header />
      <main id="main">
        <section className="hero" id="top">
          <div className="shell hero-grid">
            <div className="hero-copy">
              <p className="eyebrow eyebrow--amber">
                Ontario-born · In development
              </p>
              <h1>Turn a free afternoon into an adventure.</h1>
              <p className="hero-intro">
                Choose where you are, how long you have, and what interests you.
                Wander North creates a personalized drive filled with places
                worth discovering.
              </p>
              <div className="hero-actions">
                <a
                  className="button"
                  href="#waitlist"
                  onClick={() => trackEvent("hero_cta_clicked")}
                >
                  Join the Early Access List
                </a>
                <a
                  className="button button--ghost"
                  href="#how-it-works"
                  onClick={() => trackEvent("how_it_works_clicked")}
                >
                  See How It Works <span aria-hidden="true">↓</span>
                </a>
              </div>
              <p className="credibility">
                <span aria-hidden="true">●</span> Being built in Ontario for
                people who want to explore more.
              </p>
            </div>
            <div className="hero-media">
              <HeroMedia asset={mediaAssets.heroDemo} />
            </div>
          </div>
        </section>

        <Section
          id="why"
          eyebrow="The problem"
          title="Finding somewhere to go should not take longer than the trip."
          intro="A free day can disappear into tabs, lists, and indecision. Wander North is being built to turn a few simple choices into a plan worth leaving home for."
        >
          <div className="editorial-grid">
            {problems.map(([title, copy], index) => (
              <article key={title} className="problem-card">
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          id="how-it-works"
          tone="forest"
          eyebrow="How it works"
          title="From ‘maybe we should go somewhere’ to a route in minutes."
          intro="The planned experience keeps the choices simple and does the research-heavy work behind the scenes."
        >
          <div className="steps-grid">
            {steps.map(([number, title, copy]) => (
              <article className="step" key={number}>
                <span className="step-number">{number}</span>
                <div className="step-icon" aria-hidden="true">
                  {number === "01"
                    ? "⌖"
                    : number === "02"
                      ? "↑"
                      : number === "03"
                        ? "✦"
                        : "↝"}
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="See the idea"
          title="An adventure shaped around your Saturday."
          intro="This non-functional concept shows how a few preferences could become a useful, editable route—without connecting to a maps API."
        >
          <TripPreview />
        </Section>

        <Section
          tone="sand"
          eyebrow="Why it matters"
          title="Less planning. More stories."
          intro="The best outcome is not a clever route. It is a day you would not have had otherwise."
        >
          <div className="benefit-grid">
            {benefits.map(([title, copy], index) => (
              <article key={title}>
                <span className="benefit-symbol" aria-hidden="true">
                  {["↗", "◎", "⌂", "♥"][index]}
                </span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          id="features"
          eyebrow="Planned capabilities"
          title="Built for discovery—not just directions."
          intro="Wander North is still being developed. These labels show what is central to early access and what remains exploratory."
        >
          <div className="feature-grid">
            {features.map(([title, status, copy]) => (
              <article className="feature-card" key={title}>
                <p className="status">{status}</p>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          tone="ink"
          eyebrow="Made for ordinary free days"
          title="Built for the days when you want to go somewhere."
          intro="Not every adventure needs a passport, a tent, or a week off. Sometimes it just needs a good first turn."
        >
          <div className="use-case-grid">
            {useCases.map(([title, copy, assetKey]) => (
              <article className="use-card" key={title}>
                <MediaPlaceholder asset={mediaAssets[assetKey]} compact />
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </Section>

        <Section id="waitlist" tone="forest" className="waitlist-section">
          <div className="waitlist-layout">
            <div className="waitlist-copy">
              <p className="eyebrow eyebrow--amber">
                Help decide what gets built
              </p>
              <h2>Join the people shaping Wander North.</h2>
              <p>
                Tell us how you travel and what would make the product genuinely
                useful. Your response will help prioritize routes, stops, travel
                styles, and pricing before more development continues.
              </p>
              <ul>
                <li>Be among the first to test Wander North.</li>
                <li>Help shape the routes, stops, and features.</li>
                <li>
                  Get only meaningful development and early-access updates.
                </li>
              </ul>
              <div className="validation-note">
                <strong>This is a real research form.</strong>
                <span>
                  The app is in development. Joining does not create an app
                  account or promise a launch date.
                </span>
              </div>
            </div>
            <WaitlistForm />
          </div>
        </Section>

        <Section
          eyebrow="Why Wander North"
          title="Interesting places are everywhere. Connecting them is the hard part."
        >
          <div className="founder-grid">
            <MediaPlaceholder asset={mediaAssets.founderStory} compact />
            <div className="founder-copy">
              <p>
                Wander North began with a simple frustration: there are
                interesting places everywhere, but finding and connecting them
                into a worthwhile trip takes too much work.
              </p>
              <p>
                The product is being developed in Ontario and shaped through
                real user feedback. The early-access list is not just a launch
                list—it is a way to learn which trips people actually want,
                which stops matter, and what would make the experience worth
                returning to.
              </p>
              <p className="signature">Built locally. Shaped by explorers.</p>
            </div>
          </div>
        </Section>

        <Section
          id="faq"
          tone="sand"
          eyebrow="Questions, answered honestly"
          title="What to know before you join."
        >
          <div className="faq-list">
            {faqs.map(([question, answer]) => (
              <details
                key={question}
                onToggle={(event) =>
                  event.currentTarget.open &&
                  trackEvent("faq_opened", { question })
                }
              >
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </Section>

        <section className="final-cta">
          <div className="shell final-grid">
            <div>
              <p className="eyebrow eyebrow--amber">
                Stay close. Go somewhere new.
              </p>
              <h2>Your next favourite place may be closer than you think.</h2>
              <p>
                Join early access and help decide which adventures Wander North
                builds first.
              </p>
            </div>
            <WaitlistForm compact source="final_cta" />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
