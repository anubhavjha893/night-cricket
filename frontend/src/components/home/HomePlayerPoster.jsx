import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import { PlayerPoster } from "../common/PlayerPoster";

export function HomePlayerPoster() {
  const [player, setPlayer] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api("/player/me", { signal: controller.signal })
      .then(setPlayer)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <Link
      to="/dashboard"
      className="home-player-poster"
      aria-label="View or edit your player poster"
    >
      {player && <PlayerPoster player={player} />}
      <span>Your player poster ↗</span>
    </Link>
  );
}
