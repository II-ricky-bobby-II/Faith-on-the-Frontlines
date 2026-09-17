import Link from "next/link";

const features = [
  ["01", "Inspiring stories", "Hear powerful testimonies from the frontlines."],
  ["02", "Global perspective", "Gain a deeper understanding of God's work worldwide."],
  ["03", "Take action", "Be equipped to pray, give, and get involved."],
];

export function HostEventSection() {
  return (
    <section className="host-strip" aria-labelledby="host-event-heading">
      <div className="section-shell host-inner">
        <div className="host-intro">
          <span className="host-seal" aria-hidden="true">&#10013;</span>
          <div>
            <h2 id="host-event-heading" className="display-heading">Bring the frontlines to your community</h2>
            <p>Your church, home, Bible study, or community group can make a difference by hearing and sharing what God is doing among the least reached around the world.</p>
          </div>
        </div>
        <div className="host-copy">
          <div className="feature-row">
            {features.map(([icon, title, copy]) => <div className="feature" key={title}><span className="feature-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{copy}</p></div>)}
          </div>
        </div>
        <Link className="button button-teal" href="/host-an-event">Host an event</Link>
      </div>
    </section>
  );
}

