import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { getEvents } from "@/lib/payload";
import { EventInvitationSignup } from "@/components/EventInvitationSignup";

export const metadata: Metadata = { title: "Events & Stories", description: "Find the next Faith on the Frontlines gathering or explore stories from past events." };

export default async function EventsPage() {
  const events = await getEvents();
  return (
    <>
      <header className="page-hero"><div className="section-shell"><p className="eyebrow">Gather. Listen. Respond.</p><h1 className="display-heading">Events &amp; Stories</h1><p>Upcoming gatherings will appear here when the next date is ready. Until then, join the invitation list or spend time with a story from a past event.</p></div></header>
      <section className="page-section" aria-labelledby="events-list"><div className="section-shell"><h2 id="events-list" className="sr-only">Faith on the Frontlines events and stories</h2>{events.length ? <><div className="filters" aria-label="Event filters"><span className="filter-pill active">All events</span><span className="filter-pill">California</span><span className="filter-pill">Nevada</span><span className="filter-pill">Fall 2026</span></div><div className="event-grid event-grid-all">{events.map((event) => <EventCard key={event.slug} event={event} />)}</div></> : <div className="events-archive-empty"><p className="script-label">Coming soon</p><h2>New gatherings are on the way.</h2><p>We do not have a public event date to share right now. Join the invitation list below and we’ll contact you when the next gathering is announced.</p><div className="events-archive-actions"><Link className="button button-teal" href="/events/stories-from-east-africa">Explore a past story</Link><Link className="text-link" href="/host-an-event">Host a gathering <span aria-hidden="true">→</span></Link></div></div>}<EventInvitationSignup source="events" /></div></section>
    </>
  );
}

