import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventCard } from "@/components/EventCard";
import { events, getEvent } from "@/data/events";

export function generateStaticParams() { return events.map((event) => ({ slug: event.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const event = getEvent((await params).slug);
  return event ? { title: event.title, description: event.description } : {};
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const event = getEvent((await params).slug);
  if (!event) notFound();
  const date = new Date(`${event.date}T12:00:00Z`);
  const dateLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(date);
  const jsonLd = { "@context": "https://schema.org", "@type": "Event", name: event.title, description: event.description, startDate: event.date, eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", eventStatus: "https://schema.org/EventScheduled", location: { "@type": "Place", name: event.venue, address: { "@type": "PostalAddress", streetAddress: event.address.split(",")[0], addressLocality: event.city, addressRegion: event.state, addressCountry: "US" } }, image: [event.image], organizer: { "@type": "Organization", name: "Faith on the Frontlines", url: "https://faithonthefrontlines.com" } };
  const related = events.filter((item) => item.slug !== event.slug).slice(0, 2);
  const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${event.date.replaceAll("-", "")}/${event.date.replaceAll("-", "")}&location=${encodeURIComponent(event.address)}&details=${encodeURIComponent(event.description)}`;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="event-detail-hero"><Image src={event.image} alt={event.imageAlt} fill priority sizes="100vw" unoptimized /><div className="section-shell event-detail-title"><p className="eyebrow">{event.city}, {event.state}</p><h1 className="display-heading">{event.title}</h1></div></header>
      <section className="page-section"><div className="section-shell event-detail-layout"><article className="rich-copy"><p className="eyebrow">A night of firsthand stories</p><h2>Come close to what God is doing.</h2><p>{event.description}</p><p>This gathering is designed for families, church teams, mission leaders, and anyone who wants a clearer picture of life and ministry among the least reached. You&apos;ll leave with specific ways to pray and meaningful next steps.</p><h2>What to expect</h2><p>A welcoming evening of story, conversation, guided prayer, and time to connect personally with the speaker. No prior missions experience is needed.</p></article><aside className="event-sidebar" aria-label="Event details"><dl className="detail-list"><div><dt>Date & time</dt><dd>{dateLabel}<br />{event.time}</dd></div><div><dt>Venue</dt><dd>{event.venue}<br />{event.address}</dd></div><div><dt>Speaker</dt><dd>{event.speaker}</dd></div><div><dt>Focus</dt><dd>{event.theme}</dd></div></dl><a id="register" className="button button-teal" href={event.registrationUrl}>Register to attend</a><p><a className="text-link" href={calendarUrl} target="_blank" rel="noreferrer">Add to calendar ↗</a></p><p className="form-note">Questions? <a href={`mailto:${event.contactEmail}`}>{event.contactEmail}</a></p></aside></div></section>
      <section className="page-section alt"><div className="section-shell"><p className="eyebrow">Keep listening</p><h2 className="display-heading">Related events</h2><div className="event-grid" style={{ marginTop: "2.5rem" }}>{related.map((item) => <EventCard key={item.slug} event={item} />)}</div><p style={{ marginTop: "2rem" }}><Link className="text-link" href="/events">View all events →</Link></p></div></section>
    </>
  );
}
