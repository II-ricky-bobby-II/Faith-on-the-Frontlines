import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="section-shell footer-main">
        <div><div className="footer-brand">Faith on the Frontlines<span>A Global Fellowship Ministry</span></div><p className="footer-copy">Helping churches hear firsthand stories of God&apos;s work among least-reached people—and find their place in the story.</p></div>
        <div className="footer-column"><h2>Explore</h2><nav aria-label="Footer navigation"><Link href="/about">About</Link><Link href="/events">Upcoming events</Link><Link href="/host-an-event">Host an event</Link><Link href="/contact">Contact</Link></nav></div>
        <div className="footer-column"><h2>Connect</h2><nav aria-label="Contact links"><a href="https://globalfellowship.org">Global Fellowship website ↗</a><a href="mailto:hello@faithonthefrontlines.com">hello@faithonthefrontlines.com</a><a href="tel:+15555550147">(555) 555-0147</a></nav></div>
      </div>
      <div className="section-shell footer-bottom"><span>© {new Date().getFullYear()} Global Fellowship. All rights reserved.</span><div className="footer-legal"><Link href="/privacy">Privacy</Link><Link href="/accessibility">Accessibility</Link></div></div>
    </footer>
  );
}
