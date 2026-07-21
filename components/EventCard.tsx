import Image from "next/image";
import Link from "next/link";
import type { Event } from "@/types/event";

const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function EventCard({ event }: { event: Event }) {
  const date = new Date(`${event.date}T12:00:00Z`);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date);
  return (
    <article className="event-card">
      <Link href={`/events/${event.slug}`} aria-label={`View ${event.title}`}>
        <div className="event-card-image">
          <Image src={event.image} alt={event.imageAlt} fill sizes="(max-width: 760px) 100vw, 33vw" unoptimized />
          <div className="date-badge" aria-hidden="true"><div><span>{month}</span><strong>{date.getUTCDate()}</strong></div></div>
        </div>
        <div className="event-card-body">
          <h3>{event.venue}</h3>
          <p className="event-location">{event.city}, {event.state}</p>
          <div className="event-meta"><span><b aria-hidden="true">□</b> {formatter.format(date)} &middot; {event.time}</span><span><b aria-hidden="true">○</b> <strong>Speaker:</strong> {event.speaker}</span></div>
          <p className="event-theme">{event.theme}</p>
          <span className="text-link">Event details <span aria-hidden="true">-&gt;</span></span>
        </div>
      </Link>
    </article>
  );
}
