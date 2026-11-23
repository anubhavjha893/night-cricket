// Coordinates are in the original 1024 × 1536 artwork.
export const posterTemplate = "/assets/participation-template.webp";

export function posterDetails(player) {
  return {
    name: player.name.toUpperCase(),
    role: player.roles
      .join(" / ")
      .replace(/All-rounder/gi, "All Rounder")
      .toUpperCase(),
    address: player.address.trim().split(/\s+/u).slice(0, 5).join(" "),
  };
}

function drawPhoto(ctx, photo) {
  const frame = { x: 259, y: 281, w: 506, h: 647 };
  const scale = Math.max(frame.w / photo.width, frame.h / photo.height);
  const w = frame.w / scale;
  const h = frame.h / scale;
  // Preserve proportions, favouring the upper part of tall portraits.
  ctx.drawImage(
    photo,
    (photo.width - w) / 2,
    (photo.height - h) * 0.3,
    w,
    h,
    frame.x,
    frame.y,
    frame.w,
    frame.h,
  );
}

export function drawPoster(canvas, template, photo, { name, role, address }) {
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);
  drawPhoto(ctx, photo);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "#090900";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 4;
  const gold = ctx.createLinearGradient(0, 957, 0, 1048);
  gold.addColorStop(0, "#fff1ba");
  gold.addColorStop(0.42, "#ffdc73");
  gold.addColorStop(0.72, "#ffbf22");
  gold.addColorStop(1, "#e18a00");
  ctx.font = '900 122px Impact, "Arial Black", sans-serif';
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffe085";
  ctx.strokeText(name, 512, 1047, 777);
  ctx.fillStyle = gold;
  ctx.fillText(name, 512, 1047, 777);
  ctx.font = '900 36px "Arial Black", sans-serif';
  ctx.letterSpacing = "6px";
  ctx.fillStyle = "#ffe49a";
  ctx.fillText(role, 512, 1108, 478);
  ctx.font = "bold 33px Arial, sans-serif";
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#ffedc6";
  // Keep extremely long, unbroken address tokens legible inside the plaque.
  let displayAddress = address;
  if (ctx.measureText(address).width > 900) {
    ctx.font = "bold 26px Arial, sans-serif";
    const letters = Array.from(address);
    let low = 0,
      high = letters.length;
    while (low < high) {
      const end = Math.ceil((low + high) / 2);
      if (ctx.measureText(letters.slice(0, end).join("") + "…").width <= 670)
        low = end;
      else high = end - 1;
    }
    if (low < letters.length)
      displayAddress = letters.slice(0, low).join("").trimEnd() + "…";
  }
  ctx.fillText(displayAddress, 563, 1341, 614);
  ctx.restore();
}
