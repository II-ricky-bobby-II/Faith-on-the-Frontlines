import { sampleEvents } from "@/data/events";
import type { Event } from "@/types/event";

type PayloadMedia = {
  alt?: string | null;
  url?: string | null;
  sizes?: { card?: { url?: string | null } | null } | null;
};

type PayloadEvent = {
  slug: string;
  title: string;
  venue: string;
  city: string;
  state: string;
  address: string;
  date: string;
  time: string;
  speaker: string;
  theme: string;
  image?: PayloadMedia | string | null;
  description: string;
  contactEmail: string;
  registrationUrl?: string | null;
};

type PayloadList<T> = { docs: T[] };

function cmsBaseUrl() {
  return process.env.PAYLOAD_CMS_URL?.replace(/\/$/, "");
}

function absoluteMediaUrl(path?: string | null) {
  if (!path) return sampleEvents[0].image;
  if (/^https?:\/\//.test(path)) return path;
  return `${cmsBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
}

function mapEvent(document: PayloadEvent): Event {
  const media = typeof document.image === "object" ? document.image : null;
  const mediaUrl = media?.sizes?.card?.url ?? media?.url;
  return {
    slug: document.slug,
    title: document.title,
    venue: document.venue,
    city: document.city,
    state: document.state,
    address: document.address,
    date: document.date.slice(0, 10),
    time: document.time,
    speaker: document.speaker,
    theme: document.theme,
    image: absoluteMediaUrl(mediaUrl),
    imageAlt: media?.alt || `${document.title} event image`,
    description: document.description,
    contactEmail: document.contactEmail,
    registrationUrl: document.registrationUrl || undefined,
  };
}

async function payloadFetch<T>(path: string): Promise<T | null> {
  const baseUrl = cmsBaseUrl();
  if (!baseUrl) return null;

  const headers: HeadersInit = { Accept: "application/json" };
  const apiKey = process.env.PAYLOAD_CMS_API_KEY;
  if (apiKey) {
    const collection = process.env.PAYLOAD_CMS_API_KEY_COLLECTION || "users";
    headers.Authorization = `${collection} API-Key ${apiKey}`;
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers,
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getEvents(options: { limit?: number } = {}): Promise<Event[]> {
  const params = new URLSearchParams({
    depth: "1",
    limit: String(options.limit ?? 100),
    sort: "date",
    "where[_status][equals]": "published",
    "where[date][greater_than_equal]": new Date().toISOString(),
  });
  const response = await payloadFetch<PayloadList<PayloadEvent>>(`/api/events?${params}`);
  if (!response) return sampleEvents.slice(0, options.limit);
  return response.docs.map(mapEvent);
}

export async function getEventBySlug(slug: string): Promise<Event | undefined> {
  const params = new URLSearchParams({
    depth: "1",
    limit: "1",
    "where[slug][equals]": slug,
    "where[_status][equals]": "published",
  });
  const response = await payloadFetch<PayloadList<PayloadEvent>>(`/api/events?${params}`);
  if (!response) return sampleEvents.find((event) => event.slug === slug);
  return response.docs[0] ? mapEvent(response.docs[0]) : undefined;
}
