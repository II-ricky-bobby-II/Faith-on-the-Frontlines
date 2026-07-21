"use client";

import Link from "next/link";
import { useState } from "react";

const links = [
  ["Home", "/"], ["About", "/about"], ["Events", "/events"],
  ["Host an Event", "/host-an-event"], ["Contact", "/contact"],
];

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mobile-nav">
      <button className="menu-button" type="button" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">{open ? "×" : "☰"}</span>
      </button>
      {open && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile navigation">
          {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
          <Link className="button button-tan" href="/host-an-event" onClick={() => setOpen(false)}>Host an event</Link>
        </nav>
      )}
    </div>
  );
}
