import type { Event } from "@/types/event";

export const sampleEvents: Event[] = [
  {
    slug: "stories-from-east-africa",
    title: "Stories from East Africa",
    venue: "Grace Community Church",
    city: "Fresno",
    state: "CA",
    address: "1720 E Butler Avenue, Fresno, CA 93702",
    date: "2026-09-18",
    time: "6:30 PM – 8:30 PM",
    speaker: "Daniel M.",
    theme: "Church planting among rural communities in East Africa",
    image: "https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "Children gathering together outdoors in East Africa",
    description: "Spend an evening with Daniel as he shares what God is doing through local believers in places where the church is still young. Hear honest stories of costly faith, patient friendship, and communities encountering the hope of Jesus.",
    contactEmail: "events@faithonthefrontlines.org",
    registrationUrl: "#register",
  },
  {
    slug: "hope-across-central-asia",
    title: "Hope Across Central Asia",
    venue: "River City Bible Fellowship",
    city: "Sacramento",
    state: "CA",
    address: "450 River Park Drive, Sacramento, CA 95815",
    date: "2026-10-09",
    time: "7:00 PM – 9:00 PM",
    speaker: "Sarah K.",
    theme: "Faithful presence among least-reached families in Central Asia",
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "Friends gathered in conversation outdoors",
    description: "Meet Sarah and hear how hospitality, language learning, and long-term friendship are opening doors for the good news in Central Asia. This gathering includes guided prayer and practical ways your church can stand with frontline workers.",
    contactEmail: "events@faithonthefrontlines.org",
    registrationUrl: "#register",
  },
  {
    slug: "faith-along-the-silk-road",
    title: "Faith Along the Silk Road",
    venue: "North Hills Church",
    city: "Reno",
    state: "NV",
    address: "3100 Summit Ridge Way, Reno, NV 89523",
    date: "2026-11-14",
    time: "5:30 PM – 7:30 PM",
    speaker: "Michael & Ana R.",
    theme: "Everyday witness and disciple-making along the Silk Road",
    image: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "People sharing a warm conversation in a community setting",
    description: "Michael and Ana invite you into the everyday realities of serving along the Silk Road. Their stories reveal how prayer, ordinary meals, and courageous local believers are shaping a growing community of faith.",
    contactEmail: "events@faithonthefrontlines.org",
    registrationUrl: "#register",
  },
];

export function getEvent(slug: string) {
  return sampleEvents.find((event) => event.slug === slug);
}

