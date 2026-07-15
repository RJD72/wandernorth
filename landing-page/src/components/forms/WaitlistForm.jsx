import { useState } from "react";
import { trackEvent } from "../../services/analyticsService.js";
import { getReferralSource, submitWaitlist } from "../../services/waitlistService.js";

const initial = { firstName: "", email: "", region: "Ontario", travelStyle: "", desiredOutcome: "", valueReason: "", pricingPreference: "", wantsEarlyTesting: false, website: "" };
const travelStyles = ["Spontaneous day trips", "Family outings", "Motorcycle rides", "Camping and RV trips", "Scenic drives", "Food and small-town trips", "Weekend road trips", "Other"];
const valueReasons = ["It saves me planning time.", "It finds places I would otherwise miss.", "It works within the time I have.", "It creates routes around my interests.", "It helps me explore close to home.", "It makes group trip planning easier."];
const prices = ["Free with limited features", "One-time purchase under $10", "One-time purchase between $10 and $25", "Monthly subscription under $5", "Annual subscription under $30", "I would need to try it first", "I would only use it if free"];

function validate(values) {
  const errors = {};
  if (!values.firstName.trim()) errors.firstName = "Please share your first name.";
  if (!/^\S+@\S+\.\S+$/.test(values.email)) errors.email = "Enter a valid email address.";
  if (!values.region.trim()) errors.region = "Please add your province or region.";
  if (!values.travelStyle) errors.travelStyle = "Choose the travel style that fits you best.";
  if (!values.desiredOutcome.trim()) errors.desiredOutcome = "Tell us what you most want help with.";
  return errors;
}

function Field({ label, error, children, hint }) {
  return <div className="field"><label>{label}{children}</label>{hint && <small>{hint}</small>}{error && <p className="field-error" role="alert">{error}</p>}</div>;
}

export default function WaitlistForm({ compact = false, source = "main_form" }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }));
  const begin = () => status === "idle" && trackEvent("waitlist_form_started", { source });

  async function handleSubmit(event) {
    event.preventDefault();
    if (values.website) return;
    const submissionValues = compact
      ? { ...values, travelStyle: "Quick signup — not provided", desiredOutcome: "Quick early-access signup" }
      : values;
    const nextErrors = validate(submissionValues);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setStatus("error"); setMessage("Please fix the highlighted fields."); return; }
    setStatus("loading"); setMessage("");
    const payload = { ...submissionValues, website: undefined, referralSource: getReferralSource(), submittedAt: new Date().toISOString() };
    try {
      const result = await submitWaitlist(payload);
      trackEvent("waitlist_form_submitted", { source, travelStyle: values.travelStyle, persisted: result.persisted });
      setStatus("success");
      setMessage(result.persisted ? "You’re on the list. We’ll only send meaningful Wander North updates." : "Development preview complete — this signup was simulated and was not saved.");
      setValues(initial);
    } catch (error) {
      setStatus("error"); setMessage(error.message);
    }
  }

  if (status === "success") return <div className="form-success" role="status"><span aria-hidden="true">✓</span><h3>Thanks for helping shape Wander North.</h3><p>{message}</p><button className="text-button" type="button" onClick={() => { setStatus("idle"); setMessage(""); }}>Add another response</button></div>;

  return (
    <form className={`waitlist-form ${compact ? "waitlist-form--compact" : ""}`} onSubmit={handleSubmit} onFocus={begin} noValidate>
      {import.meta.env.DEV && !import.meta.env.VITE_WAITLIST_ENDPOINT && <p className="dev-notice" role="note">Development mode: submissions are simulated and not stored until VITE_WAITLIST_ENDPOINT is configured.</p>}
      <div className="honeypot" aria-hidden="true"><label>Website<input name="website" value={values.website} onChange={(e) => set("website", e.target.value)} tabIndex="-1" autoComplete="off" /></label></div>
      <div className="form-grid">
        <Field label="First name" error={errors.firstName}><input value={values.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} /></Field>
        <Field label="Email address" error={errors.email}><input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" aria-invalid={Boolean(errors.email)} /></Field>
        {!compact && <Field label="Province or region" error={errors.region}><input value={values.region} onChange={(e) => set("region", e.target.value)} autoComplete="address-level1" aria-invalid={Boolean(errors.region)} /></Field>}
        {!compact && <Field label="Primary travel style" error={errors.travelStyle}><select value={values.travelStyle} onChange={(e) => { set("travelStyle", e.target.value); trackEvent("travel_style_selected", { value: e.target.value }); }} aria-invalid={Boolean(errors.travelStyle)}><option value="">Choose one</option>{travelStyles.map((item) => <option key={item}>{item}</option>)}</select></Field>}
      </div>
      {!compact && <>
        <Field label="What would you most want Wander North to help you do?" error={errors.desiredOutcome} hint="A sentence is plenty."><textarea rows="3" value={values.desiredOutcome} onChange={(e) => set("desiredOutcome", e.target.value)} aria-invalid={Boolean(errors.desiredOutcome)} placeholder="For example: plan an interesting family day without an hour of research." /></Field>
        <Field label="What would make Wander North valuable enough to use regularly? (optional)"><select value={values.valueReason} onChange={(e) => set("valueReason", e.target.value)}><option value="">Choose one</option>{valueReasons.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="What would you consider a fair price if it consistently planned worthwhile trips? (optional)"><select value={values.pricingPreference} onChange={(e) => { set("pricingPreference", e.target.value); trackEvent("pricing_option_selected", { value: e.target.value }); }}><option value="">Choose one</option>{prices.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <label className="check-field"><input type="checkbox" checked={values.wantsEarlyTesting} onChange={(e) => { set("wantsEarlyTesting", e.target.checked); if (e.target.checked) trackEvent("early_tester_selected"); }} /><span><strong>I would be interested in testing an early version.</strong><small>I understand it may be unfinished and I may be asked for feedback.</small></span></label>
      </>}
      {compact && <input type="hidden" value="Quick email signup" readOnly />}
      <button className="button button--full" type="submit" disabled={status === "loading"} onClick={() => compact && trackEvent("final_cta_clicked")}>
        {status === "loading" ? "Joining…" : compact ? "Join Early Access" : "Join the Early Access List"}
      </button>
      <p className="privacy-note">No spam. Only meaningful development updates and early-access information. Your details will not be sold.</p>
      {message && <p className="form-message" role="alert">{message}</p>}
    </form>
  );
}
