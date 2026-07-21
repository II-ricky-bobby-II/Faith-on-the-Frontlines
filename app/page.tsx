import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { Hero } from "@/components/Hero";
import { HostEventSection } from "@/components/HostEventSection";
import { getEvents } from "@/lib/payload";

export default async function HomePage() {
  const events = await getEvents({ limit: 3 });
  return (
    <>
      <Hero />
      <section className="events-section" aria-labelledby="upcoming-events">
        <div className="section-shell events-layout">
          <div className="events-intro">
            <p className="script-label">Upcoming</p>
            <h2 id="upcoming-events" className="display-heading">
              <span>Faith on the</span>
              Frontlines events
            </h2>
            <p>
              Join us in hearing firsthand stories from the frontlines and be
              inspired to pray, give, and go.
            </p>
            <Link className="button button-teal" href="/events">
              Register to attend
            </Link>
          </div>
          <div className="event-grid event-grid-home">
            {events.slice(0, 3).map((event) => (
              <EventCard key={event.slug} event={event} />
            ))}
          </div>
        </div>
        <Link className="all-events-link" href="/events">
          View all upcoming events <span aria-hidden="true">-&gt;</span>
        </Link>
      </section>
      <HostEventSection />
    </>
  );
}
