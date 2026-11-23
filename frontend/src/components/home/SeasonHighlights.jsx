import React from "react";
import { Expand } from "lucide-react";
import "../../styles/highlights.css";

const highlights = [
  {
    image: "/assets/season-1-welcome.webp",
    imageSet:
      "/assets/season-1-welcome-420.webp 420w, /assets/season-1-welcome-640.webp 640w, /assets/season-1-welcome-960.webp 960w, /assets/season-1-welcome.webp 1536w",
    alt: "A player and guests sharing a bouquet during the Season 1 gathering",
    title: "A warm welcome.",
    caption: "A moment from our first season’s gathering.",
  },
  {
    image: "/assets/season-1-trophy.webp",
    imageSet:
      "/assets/season-1-trophy-420.webp 420w, /assets/season-1-trophy-640.webp 640w, /assets/season-1-trophy-960.webp 960w, /assets/season-1-trophy.webp 1536w",
    alt: "Two Season 1 cricket players holding a trophy on the ground at night",
    title: "Memories under the lights.",
    caption: "Season 1 players sharing a moment with the trophy.",
  },
];

export function SeasonHighlights() {
  return (
    <section
      className="season-highlights wrap"
      aria-labelledby="season-highlights-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">LAST YEAR. STILL UNFORGETTABLE.</p>
          <h2 id="season-highlights-title">
            Season 1 <em>highlights.</em>
          </h2>
        </div>
        <p>
          The people, the celebrations and the moments that started it all. A
          look back before our next innings.
        </p>
      </div>
      <div className="highlights-grid">
        {highlights.map((highlight) => (
          <figure className="highlight-card" key={highlight.image}>
            <a
              className="highlight-photo"
              href={highlight.image}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View full-size photo: ${highlight.alt} (opens in a new tab)`}
            >
              <img
                src={highlight.image}
                srcSet={highlight.imageSet}
                sizes="(max-width: 760px) 100vw, 50vw"
                alt={highlight.alt}
                width="1536"
                height="1024"
                loading="lazy"
                decoding="async"
              />
              <span className="highlight-season">SEASON 1</span>
              <span className="highlight-expand">
                <Expand size={15} aria-hidden="true" /> View photo
              </span>
            </a>
            <figcaption>
              <h3>{highlight.title}</h3>
              <p>{highlight.caption}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
