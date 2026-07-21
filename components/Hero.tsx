import Image from "next/image";

const photos = [
  { className: "photo-main", src: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1600&q=86", alt: "Friends sharing stories around a table" },
  { className: "photo-top", src: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1000&q=84", alt: "A cross-cultural community gathering" },
  { className: "photo-bottom", src: "https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=1000&q=84", alt: "Children gathered together in East Africa" },
];

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <div className="hero-content">
          <h1 id="hero-heading" className="hero-title"><span className="hero-script">faith on the</span><strong>Frontlines</strong></h1>
          <p className="ministry-label">A Global Fellowship Ministry</p>
          <p className="hero-statement">Stories of God&apos;s work<br />among the least reached.</p>
        </div>
      </div>
      <div className="hero-photos" aria-label="Scenes from cross-cultural ministry">
        {photos.map((photo) => (
          <div key={photo.className} className={`photo-panel ${photo.className}`}>
            <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 760px) 80vw, 45vw" priority unoptimized />
          </div>
        ))}
        <div className="photo-scrim" />
      </div>
    </section>
  );
}
