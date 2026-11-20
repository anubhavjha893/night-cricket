import { tournament } from "../config/tournament.js";

export function registrationWindow(settings, date = new Date()) {
  const current = date.getTime();
  const isOpen =
    settings.registrationMode === "open" ||
    (settings.registrationMode === "scheduled" &&
      current >= Date.parse(tournament.opensAt) &&
      current < Date.parse(tournament.closesAt));
  let message = "Registration is open. Submit by 20 December 2026.";
  if (!isOpen)
    message =
      current < Date.parse(tournament.opensAt) &&
      settings.registrationMode !== "closed"
        ? "Registration opens on 24 November 2026."
        : "Registration is closed. Contact the organisers for assistance.";
  return { isOpen, message };
}
