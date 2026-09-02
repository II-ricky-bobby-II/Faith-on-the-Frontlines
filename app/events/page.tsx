import type { Metadata } from "next";
import { EventCard } from "@/components/EventCard";
import { getEvents } from "@/lib/payload";
import { EventInvitationSignup } from "@/components/EventInvitationSignup";

export const metadata: Metadata = { title: "Upcoming Events", description: "Find a Faith on the Frontlines gathering near you." };

export default async function EventsPage() {
  const events = await getEvents();
  return (
    <>
      <header className="page-hero"><div className="section-shell"><p className="eyebrow">Gather. Listen. Respond.</p><h1 className="display-heading">Upcoming Events</h1><p>Meet frontline workers, hear honest stories of God at work, and discover practical ways to stand with least-reached communities.</p></div></header>
      <section className="page-section" aria-labelledby="events-list"><div className="section-shell"><h2 id="events-list" className="sr-only">All upcoming events</h2><div className="filters" aria-label="Event filters"><span className="filter-pill active">All events</span><span className="filter-pill">California</span><span className="filter-pill">Nevada</span><span className="filter-pill">Fall 2026</span></div>{events.length ? <div className="event-grid event-grid-all">{events.map((event) => <EventCard key={event.slug} event={event} />)}</div> : <div><h2>No gatherings are scheduled yet.</h2><p>Join the invitation list below or ask about bringing Faith on the Frontlines to your church.</p></div>}<EventInvitationSignup source="events" /></div></section>
    </>
  );
}
