"use client";

import { FormEvent, useState } from "react";

type FormStatus = "idle" | "submitting" | "success" | "error";

export function InquiryForm({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const nextErrors: Record<string, string> = {};
    ["contactName", "email", "cityState", ...(compact ? [] : ["churchName"])].forEach((name) => { if (!String(data.get(name) ?? "").trim()) nextErrors[name] = "This field is required."; });
    if (data.get("email") && !/^\S+@\S+\.\S+$/.test(String(data.get("email")))) nextErrors.email = "Enter a valid email address.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setStatus("error"); return; }
    setStatus("submitting");
    try { const response = await fetch("/api/inquiry", { method: "POST", body: data }); if (!response.ok) throw new Error(); setStatus("success"); form.reset(); } catch { setStatus("error"); }
  }
  const field = (name: string, label: string, type = "text", required = false) => <div className="field"><label htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} type={type} required={required} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} />{errors[name] && <p id={`${name}-error`} className="field-error">{errors[name]}</p>}</div>;
  return (
    <form className="inquiry-form" onSubmit={submit} noValidate>
      {!compact && field("churchName", "Church name", "text", true)}
      {field("contactName", "Contact name", "text", true)}
      {field("email", "Email", "email", true)}
      {field("phone", "Phone", "tel")}
      {field("cityState", "City & state", "text", true)}
      {!compact && <><div className="field"><label htmlFor="attendance">Approximate attendance</label><select id="attendance" name="attendance" defaultValue=""><option value="">Select a range</option><option>Under 50</option><option>50–100</option><option>100–250</option><option>250+</option></select></div>{field("preferredDates", "Preferred dates")}<div className="field field-full"><label htmlFor="eventType">Event type</label><select id="eventType" name="eventType" defaultValue="Evening gathering"><option>Evening gathering</option><option>Sunday service</option><option>Missions conference</option><option>Leadership gathering</option><option>Not sure yet</option></select></div></>}
      <div className="field field-full"><label htmlFor="details">{compact ? "How can we help?" : "Additional details"}</label><textarea id="details" name="details" /></div>
      {status === "success" && <p className="form-status" role="status">Thank you. Your message has been received, and our team will follow up soon.</p>}
      {status === "error" && !Object.keys(errors).length && <p className="field-error field-full" role="alert">Something went wrong. Please try again or email us directly.</p>}
      <div className="field-full"><button className="button button-teal" type="submit" disabled={status === "submitting"}>{status === "submitting" ? "Sending…" : compact ? "Send message" : "Start the conversation"}</button><p className="form-note">This initial form records the inquiry for demonstration. Connect the server endpoint to your email or CRM before launch.</p></div>
    </form>
  );
}
