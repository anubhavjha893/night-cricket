import React from "react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="wrap">
      <Link className="brand footer-brand" to="/">
        <span className="brand-icon" aria-hidden="true">
          U<span>G</span>M
        </span>
        <span>
          URMILA GUPTA MEMORIAL<small>CRICKET TOURNAMENT · SEASON 2</small>
        </span>
      </Link>
      <p>
        Tenughat Golden Jubilee Ground
        <br />
        Day matches. Night final.
      </p>
      <div>
        <Link className="footer-link" to="/admin">
          Organiser sign in
        </Link>
        <p className="credit">
          Sample stadium image:{" "}
          <a
            href="https://www.wisden.com/series/icc-mens-cricket-world-cup-2023-24/cricket-news/cwc23-venue-guide-all-you-need-to-know-about-the-10-world-cup-venues-capacity-dimensions-spin-vs-pace-records"
            target="_blank"
            rel="noreferrer"
          >
            Wisden
          </a>
        </p>
      </div>
    </footer>
  );
}
