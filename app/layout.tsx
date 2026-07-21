import type { Metadata } from "next";
import { headers } from "next/headers";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "faithonthefrontlines.com";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
  metadataBase: new URL(origin),
  title: {
    default: "Faith on the Frontlines | A Global Fellowship Ministry",
    template: "%s | Faith on the Frontlines",
  },
  description:
    "Hear firsthand stories of God's work among the least reached and discover how your church can pray, give, and go.",
  openGraph: {
    title: "Faith on the Frontlines",
    description: "Stories of God's work among the least reached.",
    type: "website",
    siteName: "Faith on the Frontlines",
    images: [{ url: `${origin}/og.png`, width: 1536, height: 896, alt: "Faith on the Frontlines — Stories of God's work among the least reached" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Faith on the Frontlines",
    description: "Stories of God's work among the least reached.",
    images: [`${origin}/og.png`],
  },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
