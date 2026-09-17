import Image from "next/image";
import Link from "next/link";
import { MobileNavigation } from "./MobileNavigation";

const links = [["Home", "/"], ["About", "/about"], ["Events", "/events"], ["Host an Event", "/host-an-event"], ["Contact", "/contact"]];

export function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="parent-brand" href="/" aria-label="Faith on the Frontlines home">
          <span className="global-logo">
            <Image src="/logos/global-fellowship.png" alt="Global Fellowship" width={1795} height={792} priority />
          </span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="site-domain">faithonthefrontlines.org</span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          <Link className="button button-tan" href="/host-an-event">Host an event</Link>
        </nav>
        <MobileNavigation />
      </div>
    </header>
  );
}

