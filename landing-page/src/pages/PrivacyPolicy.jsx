import { useEffect } from "react";
import "../styles/privacy.css";

const PRIVACY_EMAIL = "rob@websmithcreations.ca";

export default function PrivacyPolicy() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Privacy Policy | Wander North";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="privacy-page">
      <a className="skip-link" href="#privacy-main">
        Skip to main content
      </a>

      <header className="privacy-header">
        <div className="shell privacy-header__inner">
          <a className="brand" href="/" aria-label="Wander North home">
            <span className="brand-mark" aria-hidden="true">
              ▲
            </span>
            <span>Wander North</span>
          </a>
          <a className="privacy-home-link" href="/">
            Back to Wander North
          </a>
        </div>
      </header>

      <main id="privacy-main" className="shell privacy-main">
        <header className="privacy-hero">
          <p className="eyebrow">Legal</p>
          <h1>Privacy Policy</h1>
          <p className="privacy-effective">Effective date: September 13, 2026</p>
          <p className="privacy-lead">
            Wander North is a route-planning and travel-discovery application
            developed by WebSmith Creations. This policy explains how the Wander
            North mobile app and the wandernorth.tech website handle information.
          </p>
        </header>

        <div className="privacy-layout">
          <aside className="privacy-summary" aria-label="Privacy summary">
            <strong>At a glance</strong>
            <ul>
              <li>No Wander North account is currently required.</li>
              <li>The mobile app does not contain third-party advertising.</li>
              <li>Saved trips are stored locally on your device.</li>
              <li>Current location is used only when you choose that feature.</li>
              <li>The website uses Google Analytics and an early-access form.</li>
            </ul>
          </aside>

          <article className="privacy-content">
            <section>
              <h2>1. Information used by the mobile app</h2>

              <h3>Location information</h3>
              <p>
                Wander North may request access to your device&apos;s current
                location when you choose the Current Location feature. Location
                is used to establish a starting point, calculate routes, and
                locate places or points of interest along or near a route.
                Wander North requests foreground location access and does not
                intentionally track your location in the background.
              </p>

              <h3>Route, search, and place information</h3>
              <p>
                Information you enter or select in the app, such as starting
                locations, destinations, search terms, route waypoints, travel
                mode, and requested categories of places, may be transmitted to
                third-party mapping and location services so Wander North can
                provide routes and place results.
              </p>
              <p>Wander North currently uses services provided by:</p>
              <ul>
                <li>Google Maps Platform, including Routes and Places services</li>
                <li>TomTom location and search services</li>
              </ul>
              <p>
                Those providers may receive technical information associated
                with normal internet requests, such as an IP address and network
                or device information, and process information according to
                their own terms and privacy policies.
              </p>

              <h3>Saved trips</h3>
              <p>
                Trips you choose to save are stored locally in the app&apos;s
                storage on your device. Wander North does not currently
                synchronize saved trips to a WebSmith Creations user account or
                cloud database. Locally stored trips may remain until you delete
                them, clear the app&apos;s data, or uninstall the app.
              </p>
            </section>

            <section>
              <h2>2. Accounts, advertising, and app analytics</h2>
              <p>
                Wander North does not currently require users to create an
                account or sign in. The mobile app does not currently contain
                third-party advertising and does not currently use a third-party
                analytics or crash-reporting SDK to track activity inside the
                mobile app.
              </p>
            </section>

            <section>
              <h2>3. Information collected on wandernorth.tech</h2>

              <h3>Early-access and research forms</h3>
              <p>
                If you submit an early-access or research form, the website may
                collect information you provide, including your first name,
                email address, province or region, travel style, comments about
                what you want from Wander North, pricing preferences, and
                whether you are interested in early testing. Campaign or
                referral information associated with the page link may also be
                stored with the submission.
              </p>
              <p>
                This information is used to manage the early-access list,
                contact people who requested relevant Wander North updates or
                testing opportunities, and understand which product features are
                most useful to potential users. Wander North does not sell this
                information.
              </p>

              <h3>Website analytics</h3>
              <p>
                wandernorth.tech uses Google Analytics to understand website
                traffic and interactions such as page views and selected site
                actions. The site is configured to avoid sending form email
                addresses as analytics event properties and disables Google
                advertising-personalization signals in its analytics setup.
              </p>
            </section>

            <section>
              <h2>4. How information is shared</h2>
              <p>
                WebSmith Creations does not sell or rent personal information.
                Information may be shared with service providers only as needed
                to operate Wander North and the website, including mapping,
                routing, place-search, analytics, hosting, and database services.
                Information may also be disclosed when required by law or when
                reasonably necessary to protect users, the service, or legal
                rights.
              </p>
            </section>

            <section>
              <h2>5. Data security</h2>
              <p>
                Wander North uses HTTPS for supported network communications and
                takes reasonable steps to limit the information sent to service
                providers. No method of electronic transmission or storage is
                completely secure. Saved trips are stored in the app&apos;s local
                device storage and should not be used to store confidential or
                highly sensitive personal information.
              </p>
            </section>

            <section>
              <h2>6. Retention and deletion</h2>
              <p>
                WebSmith Creations does not currently maintain server-side user
                accounts or a server-side copy of saved mobile-app trips. Saved
                trips can be removed through the app, by clearing the app&apos;s
                local data, or by uninstalling Wander North.
              </p>
              <p>
                Early-access form submissions may be retained while Wander North
                is being developed and while the information remains reasonably
                useful for the purposes described above. You may request access,
                correction, or deletion of information you submitted through
                wandernorth.tech by contacting us at{" "}
                <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. We may
                retain limited information where required for legal, security,
                fraud-prevention, or backup purposes.
              </p>
              <p>
                Information processed by third-party providers may be retained
                according to those providers&apos; own policies.
              </p>
            </section>

            <section>
              <h2>7. Children&apos;s privacy</h2>
              <p>
                Wander North is not specifically directed to children under 13.
                The mobile app does not currently provide account registration.
                WebSmith Creations does not knowingly use the service to collect
                personal information from children under 13.
              </p>
            </section>

            <section>
              <h2>8. Changes to this policy</h2>
              <p>
                This Privacy Policy may be updated as Wander North changes or as
                new features and service providers are introduced. The effective
                date at the top of this page will be updated when the policy is
                materially revised.
              </p>
            </section>

            <section>
              <h2>9. Contact</h2>
              <address>
                <strong>WebSmith Creations</strong>
                <br />
                Ontario, Canada
                <br />
                Email: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
              </address>
            </section>
          </article>
        </div>
      </main>

      <footer className="privacy-footer">
        <div className="shell privacy-footer__inner">
          <span>© {new Date().getFullYear()} Wander North.</span>
          <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
        </div>
      </footer>
    </div>
  );
}
