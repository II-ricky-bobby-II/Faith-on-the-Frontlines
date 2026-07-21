import Link from "next/link";

const features = [
  ["✦", "Inspiring stories", "Hear powerful testimonies from the frontlines."],
  ["◎", "Global perspective", "Gain a deeper understanding of God's work worldwide."],
  ["→", "Take action", "Be equipped to pray, give, and get involved."],
];

export function HostEventSection() {
  return (
    <section className="host-strip" aria-labelledby="host-event-heading">
      <div className="section-shell host-inner">
        <h2 id="host-event-heading" className="display-heading">Bring the frontlines to your church</h2>
        <div className="host-copy">
          <p>Your church can make a difference by hearing and sharing what God is doing among the least reached around the world.</p>
          <div className="feature-row">
            {features.map(([icon, title, copy]) => <div className="feature" key={title}><span className="feature-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{copy}</p></div>)}
          </div>
        </div>
        <Link className="button button-teal" href="/host-an-event">Host an event <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
