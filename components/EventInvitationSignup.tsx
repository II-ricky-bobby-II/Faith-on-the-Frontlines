"use client";

import Link from "next/link";
import { FormEvent, useId, useState } from "react";

type FormStatus = "idle" | "submitting" | "success" | "error";

export function EventInvitationSignup({ source }: { source: "home" | "events" }) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const id = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/event-invitations", { method: "POST", body: data });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "Please check the form and try again.");
      form.reset();
      setStatus("success");
      setMessage("You’re on the invitation list. We’ll let you know when new events are announced.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <aside className={`event-invite event-invite-${source}`} aria-labelledby={`${id}-heading`}>
      <div className="event-invite-copy">
        <p className="eyebrow">Stay connected</p>
        <h2 id={`${id}-heading`}>Be invited to the next gathering.</h2>
        <p>Join the invitation list and we’ll email you when new Faith on the Frontlines events are announced.</p>
      </div>
      <form className="event-invite-form" onSubmit={submit} noValidate>
        <input type="hidden" name="source" value={source} />
        <div className="invite-honeypot" aria-hidden="true">
          <label htmlFor={`${id}-website`}>Website</label>
          <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="invite-field">
          <label htmlFor={`${id}-first-name`}>First name <span>(optional)</span></label>
          <input id={`${id}-first-name`} name="firstName" type="text" autoComplete="given-name" />
        </div>
        <div className="invite-field">
          <label htmlFor={`${id}-email`}>Email address</label>
          <input id={`${id}-email`} name="email" type="email" autoComplete="email" required />
        </div>
        <div className="invite-field">
          <label htmlFor={`${id}-location`}>City &amp; state <span>(optional)</span></label>
          <input id={`${id}-location`} name="cityState" type="text" autoComplete="address-level2" placeholder="Sacramento, CA" />
        </div>
        <label className="invite-consent" htmlFor={`${id}-consent`}>
          <input id={`${id}-consent`} name="consent" type="checkbox" value="yes" required />
          <span>Yes, email me about future Faith on the Frontlines events.</span>
        </label>
        <div className="invite-action">
          <button className="button button-tan" type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "Joining…" : "Join the invitation list"}
          </button>
          <p>Occasional event invitations only. Unsubscribe anytime. See our <Link href="/privacy">privacy policy</Link>.</p>
        </div>
        {message && <p className={`invite-status ${status}`} role={status === "error" ? "alert" : "status"}>{message}</p>}
      </form>
    </aside>
  );
}
