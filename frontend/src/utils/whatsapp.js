export function formatWhatsAppNumber(value) {
  const raw = String(value ?? "").trim();
  if (!/^\+?[\d\s()-]+$/.test(raw))
    throw new Error(
      "Invalid mobile number. Use a 10-digit Indian number or the same number with country code 91.",
    );
  let number = raw.replace(/[\s()-]/g, "");
  if (number.startsWith("+")) {
    if (!/^\+91[6-9]\d{9}$/.test(number))
      throw new Error(
        "Invalid mobile number. Check the Indian country code and 10-digit number.",
      );
    number = number.slice(1);
  } else if (number.startsWith("0091")) {
    number = number.slice(2);
  }
  if (/^[6-9]\d{9}$/.test(number)) return `91${number}`;
  if (/^91[6-9]\d{9}$/.test(number)) return number;
  throw new Error(
    "Invalid mobile number. Check the Indian country code and 10-digit number.",
  );
}

export function buildWhatsAppMessage({
  player,
  tournament,
  status,
  auctionDate = "",
}) {
  const name = String(player.name).trim();
  const tournamentName = `${tournament.name}${tournament.season ? ` — Season ${tournament.season}` : ""}`;
  if (status === "approved") {
    let date = "Jald announce ki jayegi";
    if (auctionDate) {
      const parsed = new Date(`${auctionDate}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(auctionDate) ||
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== auctionDate
      )
        throw new Error(
          "The auction date is invalid. Please correct it in admin settings.",
        );
      date = new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(parsed);
    }
    return `Namaste ${name}, congratulations! ${tournamentName} mein aapka registration successfully verify aur approve ho gaya hai.\n\nAuction date: ${date}.\n\nAuction ke baad aapko aapki team aur team owner ki details bata di jayengi.\n\n— Tournament Organising Committee`;
  }
  if (status === "rejected")
    return `Namaste ${name}, ${tournamentName} ke liye aapka registration approve nahi ho saka, kyunki aapka payment receive/verify nahi hua hai ya payment screenshot sahi ya saaf nahi hai.\n\nKripya apna payment check karke player dashboard mein "Correct & resubmit" kholein aur sahi, readable payment screenshot ke saath form dobara submit karein. Agar pehle payment ho chuka hai toh dobara payment na karein. Sahayata ke liye organiser se sampark karein.\n\n— Tournament Organising Committee`;
  throw new Error("Select Registration Approved or Registration Rejected.");
}

export function buildWhatsAppLink(options) {
  return `https://wa.me/${formatWhatsAppNumber(options.player.phone)}?text=${encodeURIComponent(buildWhatsAppMessage(options))}`;
}
